// js import vs require
/*jshint esversion: 6 */

var load = require('load-svg');
var svgMesh3d = require('svg-mesh-3d');
var MeshLine = require('three.meshline');
var SVGO = require('svgo');
var normalizeSVGPath = require('normalize-svg-path');
require('./path-data-polyfill.es5.js');

/* global AFRAME */

if (typeof AFRAME === 'undefined') {
  throw new Error('Component attempted to register before AFRAME was available.');
}

/**
 * Svgpath component for A-Frame.
 */
AFRAME.registerComponent('svgfile', {
  schema: {
    color: {type: 'color', default: '#c23d3e'},
    svgFile: {type: 'asset', default: ''},
    width: { type: 'number', default: NaN},
    height: { type: 'number', default: NaN},
    opacity: {type: 'number', default: NaN},
    curveQuality: {type: 'number', default:20},
    strokeWidthToAFrameUnits: { type:'number', default: 0.01},
    debug: {type: 'boolean', default: false} // Set to True to see wireframe
  },

  /**
   * Set if component needs multiple instancing.
   */
  multiple: true,

  
  addlisteners: function () {
    // canvas does not fire resize events, need window
    window.addEventListener( 'resize', this.do_update.bind (this) );
  },
  do_update: function () {
  
    var canvas = this.el.sceneEl.canvas;
    this.resolution.set( canvas.width,  canvas.height );
    //console.log( this.resolution );
    this.update();

  },

  /**
   * Called once when component is attached. Generally for initial setup.
   */
  init: function () { },

  update: function(oldData){

    oldData = oldData || {};


    var data = this.data;
    var svgfileComponent = this;
    var el = this.el;
    var myself = this;
    var meshData;
    this.resolution = new THREE.Vector2 ( window.innerWidth, window.innerHeight ) ;
    var sceneEl = this.el.sceneEl;
    sceneEl.addEventListener( 'render-target-loaded', this.do_update.bind(this) );
    sceneEl.addEventListener( 'render-target-loaded', this.addlisteners.bind(this) );
    var convertTransform = require('svgo/plugins/convertTransform.js');
    var convertStyleToAttrs = require('svgo/plugins/convertStyleToAttrs.js');
    var convertShapeToPath = require('./plugins/convertShapeToPath.js'); 
    var convertPathData = require('svgo/plugins/convertPathData.js'); // This generates nearly unparsable compact numbers, like "-1.4.03"
    var removeComments = require('svgo/plugins/removeComments.js');
    var svgo = new SVGO({
      full    : true,
      quiet:false,
      multipass:true,
      plugins : [ 
        {convertStyleToAttrs:convertStyleToAttrs},
        {convertShapeToPath:convertShapeToPath},
        {convertTransform:convertTransform},
        //{convertPathData: convertPathData},
        {removeComments: removeComments} ],
      js2svg  : { pretty: true }
    });



    // Run init() as a callback after we load the SVG content from the file URL
    if (this.svgDOM === undefined) {
      load(data.svgFile, function (err, svgDOM) {
        svgfileComponent.svgDOM = svgDOM;
        svgfileComponent.update();
      });
      return;
    }

    // Run init() again as a callback after we run the SVG through SVGO (to convert polygons to path, clean up)
    if (this.svgDOMcleaned === undefined) {
      svgo.optimize(svgfileComponent.svgDOM.outerHTML, function(result) {
        var parser = new DOMParser();
         // TODO: turn off debug result.data
        // console.log(result.data);
        svgfileComponent.svgDOMcleaned = parser.parseFromString(result.data, "image/svg+xml");
        svgfileComponent.update({ready: true});
      });
      return;
    }

    /// We should have a {ready:true} object at this point if we should continue further
    if (Object.keys(oldData).length === 0 && oldData.constructor === Object) return;


    function hasNoFill(el){
      var fill = el.getAttribute("fill") || "yes";
      fill=fill.toLowerCase();
      return (fill == "transparent" || fill=="none");
    }

    function calcColor(el){
      // Should look up CSS Class too...
      var f= el.getAttribute("fill") || data.color;
      if (f=="transparent" || f=="none") f = null;
      return f;
    }
    function calcSColor(el){
      return el.getAttribute("stroke") || data.color;
    }

    function pathDataToString(dat){
      return dat.reduce(function (acc, val){
        return acc + ' ' + val.type + ' ' + val.values.join(' ');
      },'');
    }
    function getStrokeWidth(path){
      if (!path) return 1; 
      var z = path.getAttribute("stroke-width");
      if (z==null || z===undefined ) return 1;
      if (typeof z == "string") z=z.replace("px","")*1;
      return z;
    }
    // Reference: https://developer.mozilla.org/en/docs/Web/API/SVGTransform
    function getScaleTransform(path){
      var ret = {x:1, y:1};
      for (var i=0; i<path.transform.baseVal.length; i++) {
        if (path.transform.baseVal[i].type==3) {ret.x += path.transform.baseVal[i].matrix.a; ret.y += path.transform.baseVal[i].matrix.d;}
      }
      return ret;
    }
    function getTranslateTransform(path){
      var ret = {x:0, y:0};
      for (var i=0; i<path.transform.baseVal.length; i++) {
        if (path.transform.baseVal[i].type==2) {ret.x += path.transform.baseVal[i].matrix.e; ret.y += path.transform.baseVal[i].matrix.f;}
      }
      return ret;
    }

    function extractSVGPaths(svgDoc) {

        var ret = [];
        // rect, polygon should've been converted to <path> by SVGO at this point
        if (svgDoc.getElementsByTagName('rect').length>0) console.warn("Only SVG <path>'s are supported; ignoring <rect> items");
        if (svgDoc.getElementsByTagName('polygon').length>0) console.warn("Only SVG <path>'s are supported; ignoring <polygon> items");
        if (svgDoc.getElementsByTagName('line').length>0) console.warn("Only SVG <path>'s are supported; ignoring <line> items");

        // These elements are not supported:
        if (svgDoc.getElementsByTagName('image').length>0) console.warn("Only SVG <path>'s are supported; ignoring <image> items");
        if (svgDoc.getElementsByTagName('text').length>0) console.warn("Only SVG <path>'s are supported; ignoring <text> items");

        Array.prototype.slice.call(svgDoc.getElementsByTagName('path')).forEach(function (path) {
          var d = pathDataToString(path.getPathData());
          var n = {strokeWidth: getStrokeWidth(path), closed: false, d:d, fillColor: calcColor(path), strokeColor: calcSColor(path), path:path, scale: getScaleTransform(path), translate:getTranslateTransform(path)};
          n.closed =  d.search(/Z/i)>0;
          if (hasNoFill(path)) n.closed=false;
          ret.push(n);
        });
        Array.prototype.slice.call(svgDoc.getElementsByTagName('circle')).forEach(function (path) {
          //https://stackoverflow.com/questions/5737975/circle-drawing-with-svgs-arc-path
          //var cx=path.cx.baseVal.value; var cy=path.cy.baseVal.value; var r=path.r.baseVal.value; var nr=-r; var dr=r*2; var ndr=-dr;
          //var d = `M ${cx}, ${cy}    m ${nr}, 0     a ${r},${r} 0 1,0 ${dr},0    a ${r},${r} 0 1,0 ${ndr},0`;
          var cirlceAttrsToPath = function(r,cx,cy) { return `M ${cx-r},${cy}    a ${r},${r} 0 1,0 ${r*2},0   a ${r},${r} 0 1,0 -${r*2},0`;};
          var d = cirlceAttrsToPath( path.r.baseVal.value, path.cx.baseVal.value, path.cy.baseVal.value); 
          var n = {strokeWidth: getStrokeWidth(path), closed: false, d:d, fillColor: calcColor(path), strokeColor: calcSColor(path), path:path, scale: getScaleTransform(path), translate:getTranslateTransform(path)};
          if (hasNoFill(path)) n.closed =false;
          ret.push(n);
        });
        Array.prototype.slice.call(svgDoc.getElementsByTagName('ellipse')).forEach(function (path) {
          // https://stackoverflow.com/questions/5737975/circle-drawing-with-svgs-arc-path/10477334#10477334
          function ellipseAttrsToPath (rx,cx,ry,cy) {
            return `M${cx-rx},${cy}    a ${rx},${ry} 0 1,0 ${rx*2},0   a ${rx},${ry} 0 1,0 -${rx*2},0`;
          }
          var d = ellipseAttrsToPath( path.rx.baseVal.value, path.cx.baseVal.value, path.ry.baseVal.value, path.cy.baseVal.value);
          var n = {strokeWidth: getStrokeWidth(path), closed: false, d:d, fillColor: calcColor(path), strokeColor: calcSColor(path), path:path, scale: getScaleTransform(path), translate:getTranslateTransform(path)};
          if (hasNoFill(path)) n.closed =false;
          ret.push(n);
        });


        return ret;
    } // function extractSVGPaths()






    var allPaths = extractSVGPaths(svgfileComponent.svgDOMcleaned);

    // Get the SVG image size, in SVG coordinates
    var viewBox = AFRAME.utils.coordinates.parse(svgfileComponent.svgDOMcleaned.documentElement.getAttribute('viewBox'));
    if (!viewBox){
      console.error('No viewBox attribute found in SVG file. This is required. Note that this property is case sensitive.');
      console.log('Info: https://www.w3.org/TR/SVG/styling.html#CaseSensitivity');
    }
    var width = viewBox.z - viewBox.x;
    var height = viewBox.w - viewBox.y;
    var aspectRatio = width/height;
    if (isNaN(data.width) && isNaN(data.height)) { // Neither is specified; use SVG native size
      data.width=width; data.height = height;
    } else if (!isNaN(data.width) ) { // Width is specified, force height to match according to aspectRatio
      data.height = data.width/aspectRatio;
    } else if (!isNaN(data.height)) { // Height is specified, force width to match according to aspectRatio
      data.width = data.height*aspectRatio;
    }



    for (var ii=0; ii<allPaths.length; ii++){
        var n = allPaths[ii];
        var mesh;

        n.fillColor = n.fillColor || data.color;
        // n.closed=false;

        if (n.closed) {
              if (data.debug){
                console.log('MeshPolygon for ');
                console.log(n);
              }
              var __private_meshData = svgMesh3d(n.d, { // TODO: change from n.d to using n.path.getPathData() SVG2 interface
                delaunay: true,
                clean: true,
                exterior: false,
                randomization: 1,
                normalize:false,
                simplify: 1,
                scale: data.curveQuality*10 //a positive number, the scale at which to approximate the curves from the SVG paths
              });

              var __private_material = new THREE.MeshStandardMaterial({
                wireframe: data.debug,
                color: n.fillColor,
                side: THREE.DoubleSide,
                opacity: isNaN(data.opacity) ? 1 : data.opacity,
                transparent: isNaN(data.opacity) || data.opacity==1 ? false : true
              });

            var createGeometry = require('three-simplicial-complex')(THREE);
            var __private_geometry = createGeometry(__private_meshData);
              __private_geometry.scale(data.width/width, data.height/height, 1); // Convert from SVG to AFrame units
              __private_geometry.scale(n.scale.x, n.scale.y, 1); // Apply the transforms while the geometry is still in SVG units
              __private_geometry.translate(data.width/width * n.translate.x, - data.height/height * n.translate.y, 0);
              __private_geometry.translate( -data.width/2, data.height/2, 0); // Center at 0,0

              this.el.object3D.add(new THREE.Mesh(__private_geometry, __private_material.clone()));// Set mesh on entity.

        } else { // !n.closed -- draw as MeshLine


              if (data.debug){
                console.log('MeshLine for ');
                console.log(n);
              }

              var __private_material = new MeshLine.MeshLineMaterial({
                color: new THREE.Color(n.strokeColor),
                resolution: this.resolution,
                sizeAttenuation: 1,
                wireframe:false,
                lineWidth: n.strokeWidth * data.strokeWidthToAFrameUnits,
                side: THREE.DoubleSide,
                opacity: isNaN(data.opacity) ? 1 : data.opacity,
                transparent:  isNaN(data.opacity) ? false : true, // Default opaccity=null so this will be false
                depthTest: isNaN(data.opacity) ? true : false 

                //near: 0.1,
                //far: 1000
              });
              var debug_material = new THREE.MeshStandardMaterial({ wireframe:true, color:0x00ff00});

              var svgPathData = n.path.getPathData(); // Uses the SVG2 polyfill. Gives us an array of PathSeg objects; must easier to parse 

              var __private_geometry = svgPathDataToGeometry(svgPathData, {curveQuality: data.curveQuality, height: height});
              __private_geometry.scale(data.width/width, data.height/height, 1); // Convert from SVG to AFrame units
              __private_geometry.scale(n.scale.x, n.scale.y, 1); // Apply the transforms while the geometry is still in SVG units
              __private_geometry.translate(data.width/width * n.translate.x, (- data.height/height * n.translate.y) - (data.height/height * height), 0);
              __private_geometry.translate( -data.width/2, data.height/2, 0); // Center at 0,0

              var geometryAsArray = [];  // For some inexplicable reason, my THREE.Geometry here is *not* an instanceof THREE.Geometry inside MeshLine. Whatevs.
              for (var v=0; v<__private_geometry.vertices.length; v++) {
                geometryAsArray.push(__private_geometry.vertices[v].x);
                geometryAsArray.push(__private_geometry.vertices[v].y);
                geometryAsArray.push(__private_geometry.vertices[v].z);
              }
              var line = new MeshLine.MeshLine();
              line.setGeometry( geometryAsArray);
              /* I have NO FREAKING CLUE why the 9th item does not render?! It appears as a cube. Either a fault in THREE or, perhaps in the MeshLineMaterial shaders */
              if (this.el.object3D.children.length==9) {
                line.geometry = line.geometry.clone(); // Cloning the 9th item makes it work like a charm. Of course.
              }  
              this.el.object3D.add(new THREE.Mesh(line.geometry,  __private_material));

        } // Draw as polygon or as line?

    } // foreach path

  },




  /**
   * Called when a component is removed (e.g., via removeAttribute).
   * Generally undoes all modifications to the entity.
   */
  remove: function () { },

  /**
   * Called on each scene tick.
   */
  // tick: function (t) { },

  /**
   * Called when entity pauses.
   * Use to stop or remove any dynamic or background behavior such as events.
   */
  pause: function () { },

  /**
   * Called when entity resumes.
   * Use to continue or add any dynamic or background behavior such as events.
   */
  play: function () { },


  calcBoundingBox: function(meshData){
    var ret = {
      x: {min:Infinity, max: -Infinity},
      y: {min:Infinity, max: -Infinity},
      z: {min:Infinity, max: -Infinity}};
    for (var p in meshData.positions) {
      ret.x.min = Math.min(ret.x.min, meshData.positions[p][0]);
      ret.x.max = Math.max(ret.x.max, meshData.positions[p][0]);
      ret.y.min = Math.min(ret.y.min, meshData.positions[p][1]);
      ret.y.max = Math.max(ret.y.max, meshData.positions[p][1]);
      ret.z.min = Math.min(ret.z.min, meshData.positions[p][2]);
      ret.z.max = Math.max(ret.z.max, meshData.positions[p][2]);
    }
    return ret;
  },




}); // end AFRame component






function svgPathDataToGeometry(svgPathData, opts){
    var geometry = new THREE.Geometry();
    var v = new THREE.Vector3(0,0,0);
    var c = null;
    var howManyCurves=0;
    var x, tmp;
    var p1, p2, c1, c2;
    var values;
    var basisVector;
    var lastPenDown;

    for (var k=0; k<svgPathData.length; k++) {
      var svgCommand = svgPathData[k];
      values = svgCommand.values;

      switch (svgCommand.type) {
        case "M":
          tmp = xyListToVertices(values);
          v = tmp.endpoint;
          lastPenDown = v.clone();
          geometry.vertices = geometry.vertices.concat(tmp.vertices.map(function(v){return v.clone();}));
          //if (i>0) console.warn('SVG path contains M commands after the first command. This is not yet supported and these M commands will be drawn as lines.');
          break;
        case "H":
          console.assert(svgCommand.values.length==1);
          v = new THREE.Vector3(values[0], v.y, 0);
          geometry.vertices.push(v);
          break;
        case "V":
          console.assert(values.length==1);
          v = new THREE.Vector3(v.x, values[0], 0);
          geometry.vertices.push(v.clone());
          break;
        case "L":
          tmp = xyListToVertices(values);
          v = tmp.endpoint;
          geometry.vertices = geometry.vertices.concat(tmp.vertices.map(function(v){return v.clone();}));
          break;
        case "l":
          tmp = xyListToVertices(values);
          tmp.vertices.forEach(function(t){
            geometry.vertices.push(new THREE.Vector3(t.x + v.x, t.y+v.y, 0));
          });
          break;
        case "Z":
          geometry.vertices.push(lastPenDown.clone());
          break;
        case "c":
        case "C":
            if (svgCommand.type=="C") basisVector = new THREE.Vector3(0,0,0);
            if (svgCommand.type=="c") basisVector = v;
            // The "c" command can take multiple curves in sequences, hence the while loop
            howManyCurves = values.length/6;
            console.assert(howManyCurves==Math.floor(howManyCurves));
            for (var h=0, z=0; h<howManyCurves; h++) {
              p1 = v.clone(); // Relative coordinate
              c1 = new THREE.Vector3(values[z++], values[z++], 0).add(basisVector);
              c2 = new THREE.Vector3(values[z++], values[z++], 0).add(basisVector);
              p2 = new THREE.Vector3(values[z++], values[z++], 0).add(basisVector);
              c = new THREE.CubicBezierCurve3(p1, c1, c2, p2);
              v=p2.clone();
              geometry.vertices = geometry.vertices.concat(c.getSpacedPoints ( opts.curveQuality ));
              //console.log("added c " + x + "/" + howManyCurves);
              //console.log(c);
            }
            break;
        case "A":
            geometry.vertices.pop(); // Remove the M command
            var howManyArcs = values.length/ 7;
            for (var arcNumber=0, z=0; arcNumber<howManyArcs; arcNumber++){
              var tmp = arcToSVG(v.x, v.y, values[z++], values[z++], values[z++], values[z++],        values[z++],   values[z++], values[z++]);
              howManyCurves = tmp.length/ 6;
              for (var h=0, jj=0; h<howManyCurves; h++){
                p1 = v.clone();
                c1 = new THREE.Vector3(tmp[jj++], tmp[jj++], 0);
                c2 = new THREE.Vector3(tmp[jj++], tmp[jj++], 0);
                p2 = new THREE.Vector3(tmp[jj++], tmp[jj++], 0);
                c = new THREE.CubicBezierCurve3(p1, c1, c2, p2);
                v=p2.clone();
                geometry.vertices = geometry.vertices.concat(c.getSpacedPoints ( opts.curveQuality ));
              }
            }
            break;  
        default:
          console.warn('bad');
          console.error('Unrecognized SVG command:' + svgCommand.type);

      } // swtich statement

    } // foreach SVG command in the path
    geometry.vertices.forEach(function(v){ v.y = opts.height-v.y; });
    return geometry;
} // end svgPathDataToGeometry ()

function xyListToVertices(values){
  var ret = {endpoint: null, vertices: [] };
  for (var i=0; i<values.length;) {
    ret.vertices.push(new THREE.Vector3(values[i++], values[i++],0));
  }
  ret.endpoint = ret.vertices[ret.vertices.length-1];
  return ret;
}






// This function is ripped from
// github.com/DmitryBaranovskiy/raphael/blob/4d97d4/raphael.js#L2216-L2304
// which references w3.org/TR/SVG11/implnote.html#ArcImplementationNotes
// TODO: make it human readable

var PI = Math.PI;
function __PRIVATE_radians(degress){
  return degress * (PI / 180);
}
var _120 = __PRIVATE_radians(120);

function deg2rad(deg){
  return (deg  / 180) * Math.PI;
}

function arcToSVG(x1, y1, rx, ry, angle, large_arc_flag, sweep_flag, x2, y2, recursive) {
  var f1,f2, cx,cy, res;
  angle = deg2rad(angle);
  if (!recursive) {
    var xy = __PRIVATE_rotate(x1, y1, -angle);
    x1 = xy.x;
    y1 = xy.y;
    xy = __PRIVATE_rotate(x2, y2, -angle);
    x2 = xy.x;
    y2 = xy.y;
    var x = (x1 - x2) / 2;
    var y = (y1 - y2) / 2;
    var h = (x * x) / (rx * rx) + (y * y) / (ry * ry);
    if (h > 1) {
      h = Math.sqrt(h);
      rx = h * rx;
      ry = h * ry;
    }
    var rx2 = rx * rx;
    var ry2 = ry * ry;
    var k = (large_arc_flag == sweep_flag ? -1 : 1) * Math.sqrt(Math.abs((rx2 * ry2 - rx2 * y * y - ry2 * x * x) / (rx2 * y * y + ry2 * x * x)));
    if (k == Infinity) {k = 1;} // neutralize
    cx = k * rx * y / ry + (x1 + x2) / 2;
    cy = k * -ry * x / rx + (y1 + y2) / 2;
    f1 = Math.asin(((y1 - cy) / ry).toFixed(9));
    f2 = Math.asin(((y2 - cy) / ry).toFixed(9));

    f1 = x1 < cx ? PI - f1 : f1;
    f2 = x2 < cx ? PI - f2 : f2;
    if (f1 < 0) f1 = PI * 2 + f1;
    if (f2 < 0) f2 = PI * 2 + f2;
    if (sweep_flag && f1 > f2) f1 = f1 - PI * 2;
    if (!sweep_flag && f2 > f1) f2 = f2 - PI * 2;
  } else {
    f1 = recursive[0];
    f2 = recursive[1];
    cx = recursive[2];
    cy = recursive[3];
  }
  // greater than 120 degrees requires multiple segments
  if (Math.abs(f2 - f1) > _120) {
    var f2old = f2;
    var x2old = x2;
    var y2old = y2;
    f2 = f1 + _120 * (sweep_flag && f2 > f1 ? 1 : -1);
    x2 = cx + rx * Math.cos(f2);
    y2 = cy + ry * Math.sin(f2);
    res = arcToSVG(x2, y2, rx, ry, angle, 0, sweep_flag, x2old, y2old, [f2, f2old, cx, cy]);
  }
  var t = Math.tan((f2 - f1) / 4);
  var hx = 4 / 3 * rx * t;
  var hy = 4 / 3 * ry * t;
  var curve = [
    2 * x1 - (x1 + hx * Math.sin(f1)),
    2 * y1 - (y1 - hy * Math.cos(f1)),
    x2 + hx * Math.sin(f2),
    y2 - hy * Math.cos(f2),
    x2,
    y2
  ];
  if (recursive) return curve;
  if (res) curve = curve.concat(res);
  for (var i = 0; i < curve.length;) {
    var rot = __PRIVATE_rotate(curve[i], curve[i+1], angle);
    curve[i++] = rot.x;
    curve[i++] = rot.y;
  }
  return curve;
}

function __PRIVATE_rotate(x, y, rad){
  return {
    x: x * Math.cos(rad) - y * Math.sin(rad),
    y: x * Math.sin(rad) + y * Math.cos(rad)
  };
}
