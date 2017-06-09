// js import vs require
/*jshint esversion: 6 */

var load = require('load-svg');

var createGeometry = require('three-simplicial-complex')(THREE);
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
        console.log(result.data);
        svgfileComponent.svgDOMcleaned = parser.parseFromString(result.data, "image/svg+xml");
        svgfileComponent.update();
      });
      return;
    }


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


    function extractSVGPaths(svgDoc) {

        var ret = [];
        if (svgDoc.getElementsByTagName('rect').length>0) console.warn("Only SVG <path>'s are supported; ignoring <rect> items");
        if (svgDoc.getElementsByTagName('image').length>0) console.warn("Only SVG <path>'s are supported; ignoring <image> items");
        if (svgDoc.getElementsByTagName('line').length>0) console.warn("Only SVG <path>'s are supported; ignoring <line> items");
        if (svgDoc.getElementsByTagName('text').length>0) console.warn("Only SVG <path>'s are supported; ignoring <text> items");
        if (svgDoc.getElementsByTagName('polygon').length>0) console.warn("Only SVG <path>'s are supported; ignoring <polygon> items");

        Array.prototype.slice.call(svgDoc.getElementsByTagName('path')).map(function (path) {
          var d = path.getAttribute('d').replace(/\s+/g, ' ').trim();
          var n = {strokeWidth: 1, closed: false, d:d, fillColor: calcColor(path), strokeColor: calcSColor(path), path:path};
          n.closed =  d.search(/Z/i)>0;
          if (hasNoFill(path)) n.closed=false;
          n.strokeWidth = path.getAttribute("stroke-width")*1 || 1;
          ret.push(n);
        });
        Array.prototype.slice.call(svgDoc.getElementsByTagName('circle')).map(function (path) {
          //https://stackoverflow.com/questions/5737975/circle-drawing-with-svgs-arc-path
          //var cx=path.cx.baseVal.value; var cy=path.cy.baseVal.value; var r=path.r.baseVal.value; var nr=-r; var dr=r*2; var ndr=-dr;
          //var d = `M ${cx}, ${cy}    m ${nr}, 0     a ${r},${r} 0 1,0 ${dr},0    a ${r},${r} 0 1,0 ${ndr},0`;
          const cirlceAttrsToPath = (r,cx,cy) => `M${cx-r},${cy}    a ${r},${r} 0 1,0 ${r*2},0   a ${r},${r} 0 1,0 -${r*2},0`;
          var d = cirlceAttrsToPath( path.r.baseVal.value, path.cx.baseVal.value, path.cy.baseVal.value);
          var n = {strokeWidth: 1, closed: false, d:d, fillColor: calcColor(path), strokeColor: calcSColor(path), path:path};
          n.strokeWidth = path.getAttribute("stroke-width")*1 || 1;
          if (hasNoFill(path)) n.closed =false;
          ret.push(n);
        });
        Array.prototype.slice.call(svgDoc.getElementsByTagName('ellipse')).map(function (path) {
          // https://stackoverflow.com/questions/5737975/circle-drawing-with-svgs-arc-path/10477334#10477334
          const ellipseAttrsToPath = (rx,cx,ry,cy) => `M${cx-rx},${cy}    a ${rx},${ry} 0 1,0 ${rx*2},0   a ${rx},${ry} 0 1,0 -${rx*2},0`;
          var d = ellipseAttrsToPath( path.rx.baseVal.value, path.cx.baseVal.value, path.ry.baseVal.value, path.cy.baseVal.value);
          var n = {strokeWidth: 1, closed: false, d:d, fillColor: calcColor(path), strokeColor: calcSColor(path), path:path};
          n.strokeWidth = path.getAttribute("stroke-width")*1 || 1;
          if (hasNoFill(path)) n.closed =false;
          ret.push(n);
        });
        Array.prototype.slice.call(svgDoc.getElementsByTagName('polygon')).map(function (path) {
          var n = {strokeWidth: 1, closed: false, d:myself.SVGPointListToPathstring(path.points), strokeColor: calcSColor(path), fillColor: calcColor(path), path:path};
          n.strokeWidth = path.getAttribute("stroke-width")*1 || 1;
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
        var material;
        var geometry;
        var mesh;
        n.fillColor = n.fillColor || data.color;
        n.closed=false;
        if (n.closed) {
          console.log('MeshPolygon for ');
          console.log(n);
          meshData = svgMesh3d(n.d, {
            delaunay: true,
            clean: true,
            exterior: false,
            randomization: 1,
            normalize:false,
            simplify: 1,
            scale: data.curveQuality*10 //a positive number, the scale at which to approximate the curves from the SVG paths
          });

          material = new THREE.MeshStandardMaterial({
            wireframe: data.debug,
            color: n.fillColor,
            side: THREE.DoubleSide,
            opacity: isNaN(data.opacity) ? 1 : data.opacity,
            transparent: isNaN(data.opacity) || data.opacity==1 ? false : true
          });

          geometry = createGeometry(meshData);
          geometry.scale(data.width/width, data.height/height, 1);

          mesh = new THREE.Mesh(geometry, material);// Create mesh.
          el.setObject3D('mesh'+ii, mesh);// Set mesh on entity.

        } else { // !n.closed -- draw as MeshLine
          console.log('MeshLine for ');
          console.log(n);

          material = new MeshLine.MeshLineMaterial({
            color: new THREE.Color(n.strokeColor),
            resolution: this.resolution,
            sizeAttenuation: false,
            lineWidth: n.strokeWidth,
            side: THREE.DoubleSide,
            opacity: isNaN(data.opacity) ? 1 : data.opacity,
            transparent:  isNaN(data.opacity) ? false : true, // Default opaccity=null so this will be false
            depthTest: isNaN(data.opacity) ? true : false 

            //near: 0.1,
            //far: 1000
          });
          var debug_material = new THREE.MeshBasicMaterial({ wireframe:true, color:'#ff0000'});

          //var tok = tokenizeSVGPathString(n.d);
          //geometry = svgPathToGeometry(tok, {curveQuality: data.curveQuality});
          var svgPathData = n.path.getPathData(); // Uses the SVG2 polyfill. Gives us an array of PathSeg objects; must easier to parse 
          if (n.path) 1;
          geometry = svgPathDataToGeometry(svgPathData, {curveQuality: data.curveQuality});
          geometry.scale(data.width/width, data.height/height, 1);
          var geometryAsArray = [];  // For some inexplicable reason, my THREE.Geometry here is *not* an instanceof THREE.Geometry inside MeshLine. Whatevs.
          for (var v=0; v<geometry.vertices.length; v++) {
            geometryAsArray.push(geometry.vertices[v].x);
            geometryAsArray.push(geometry.vertices[v].y);
            geometryAsArray.push(geometry.vertices[v].z);
          }
          var line = new MeshLine.MeshLine();
          line.setGeometry( geometryAsArray);
          mesh = new THREE.Mesh(line.geometry, material);
          //console.log(n.d)
          //console.log(mesh.geometry.attributes.position.array);
          this.el.setObject3D('mesh' + ii, mesh);
        }
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

  SVGPointListToPathstring: function(pl){
    var ret = '';
    ret = ret + ' M' + pl[0].x +',' + pl[0].y + ' ';
    for (var i=1; i<pl.length;i++) {
      ret = ret+ ' L' + pl[i].x +',' + pl[i].y + ' ';
    }
    return ret+"Z";
  }



}); // end AFRame component





// Removes commas, adds spaces between commands and coordinates in an SVG string, and split()s it
/*
function tokenizeSVGPathString(str) {
  str = str.replace(/\,/g,' ');
  str = str.replace(/\-/g,' -');
  str = str.replace(/[A-z]/g,' $& ');
  str = str.replace(/\s+/g,' ').trim();
  // Convert numeric strings to numbers here
  var ret = [];
  var spl = str.split(' ');
  for (var i=0; i<spl.length; i++){
    el = spl[i];
    if (isFinite(el)) {
      ret.push(el*1);
    } else if (/[mlhvcsqtaz]/ig.exec(el)) {
      ret.push(el);
    } else if (el.split('.').length>2) { // Illustrator will output coordinate pairs like 10.19.08. Who at Adobe thought this was OK?!?!?! Srsly people.
      var three = el.split('.');
      var midPos = three[0].length + 1 + (three[1].length / 2);
      ret.push(el.substring(0, midPos)*1);
      ret.push(el.substring(midPos)*1);
    }
  }
  return ret;
}
*/

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
          geometry.vertices = geometry.vertices.concat(tmp.vertices.slice());
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
          geometry.vertices = geometry.vertices.concat(tmp.vertices.slice());
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


/*
{
      var idxOfNextCommand = i; 
      for (var j=i+1; j<tok.length; j++) { if (!isFinite(tok[j]))  {idxOfNextCommand=j; break; } }
      if (idxOfNextCommand==i) idxOfNextCommand = tok.length;

      if (tok[i]=="M"){
        v = new THREE.Vector3(tok[i+1], tok[i+2], 0);
        geometry.vertices.push(v.clone());
        if (i>0) console.warn('SVG path contains M commands after the first command. This is not yet supported and these M commands will be drawn as lines.');
      }
      if (tok[i]=="m"){
        v = new THREE.Vector3(tok[i+1], tok[i+2], 0).add(v);
        geometry.vertices.push(v.clone());
      }
      if (tok[i]=="L"){ // L commands can be followed by a number of x,y coordinate pairs
        howManyCurves = (idxOfNextCommand - i-1)/ 2;
        console.assert(howManyCurves==Math.floor(howManyCurves));
        for (var x=0,j=i+1; x<howManyCurves; x++) {
          v = new THREE.Vector3(tok[j++], tok[j++], 0);
          geometry.vertices.push(v.clone());
        }
      }
      if (tok[i]=="l"){ // L commands can be followed by a number of x,y coordinate pairs
        howManyCurves = (idxOfNextCommand - i-1)/ 2;
        console.assert(howManyCurves==Math.floor(howManyCurves));
        for (var x=0, j=i+1; x<howManyCurves; x++) {
          v = new THREE.Vector3(tok[j++], tok[j++], 0).add(v);
          geometry.vertices.push(v.clone());
        }
        //v = geometry.vertices[geometry.vertices.length-1];
      }
      if (tok[i]=="H") {
        v = new THREE.Vector3(tok[i+1], v.y, 0);
        geometry.vertices.push(v.clone());
      }
      if (tok[i]=="h") {
        v = new THREE.Vector3(tok[i+1] + v.x, v.y, 0);
        geometry.vertices.push(v.clone());
      }
      if (tok[i]=="V") {
        v = new THREE.Vector3(v.x, tok[i+1], 0);
        geometry.vertices.push(v.clone());
      }
      if (tok[i]=="v") {
        v = new THREE.Vector3(v.x, tok[i+1]+v.y, 0);
        geometry.vertices.push(v.clone());
      }
      if (tok[i]=="A"){
        console.assert(idxOfNextCommand == i+8,"SVG Parser cannot handle multiple A in a sequence");
        //f ction arcToSVG(x1, y1,    rx,       ry,       angle,   large_arc_flag, sweep_flag,   x2,       y2,     recursive) {
        var tmp = arcToSVG(v.x, v.y, tok[i+1], tok[i+2], tok[i+3], tok[i+4],        tok[i+5],   tok[i+6], tok[i+7]);
        i+=7;
        howManyCurves = tmp.length/ 6;
        for (var ii=0, jj=0; ii<howManyCurves; ii++){
          p1 = v.clone();
          c1 = new THREE.Vector3(tmp[jj++], tmp[jj++], 0);
          c2 = new THREE.Vector3(tmp[jj++], tmp[jj++], 0);
          p2 = new THREE.Vector3(tmp[jj++], tmp[jj++], 0);
          c = new THREE.CubicBezierCurve3(p1, c1, c2, p2);
          v=p2.clone();
          geometry.vertices = geometry.vertices.concat(c.getSpacedPoints ( opts.curveQuality ));
        }
      }
      if (tok[i]=="a"){
        console.assert(idxOfNextCommand == i+8,"SVG Parser cannot handle multiple A in a sequence");
        //f ction arcToSVG(x1, y1,    rx,       ry,       angle,   large_arc_flag, sweep_flag,   x2,       y2,               recursive) {
        var tmp = arcToSVG(v.x, v.y,  tok[i+1], tok[i+2], tok[i+3], tok[i+4],         tok[i+5],   tok[i+6]+v.x, tok[i+7]+v.y);
        howManyCurves = tmp.length/ 6;
        for (var ii=0, jj=0; ii<howManyCurves; ii++){
          p1 = v.clone();
          c1 = new THREE.Vector3(tmp[jj++], tmp[jj++], 0);
          c2 = new THREE.Vector3(tmp[jj++], tmp[jj++], 0);
          p2 = new THREE.Vector3(tmp[jj++], tmp[jj++], 0);
          c = new THREE.CubicBezierCurve3(p1, c1, c2, p2);
          v=p2.clone();
          geometry.vertices = geometry.vertices.concat(c.getSpacedPoints ( opts.curveQuality ));
        }
      }
      if (tok[i]=="C") {
        howManyCurves = (idxOfNextCommand - i-1)/ 6;
        console.assert(howManyCurves==Math.floor(howManyCurves));
        for (var x=0; x<howManyCurves; x++) {
          p1 = v.clone();
          c1 = new THREE.Vector3(tok[i+1], tok[i+2], 0);
          c2 = new THREE.Vector3(tok[i+3], tok[i+4], 0);
          p2 = new THREE.Vector3(tok[i+5], tok[i+6], 0);
          c = new THREE.CubicBezierCurve3(p1, c1, c2, p2);
          v=p2.clone();

          geometry.vertices = geometry.vertices.concat(c.getSpacedPoints ( opts.curveQuality ));
          //console.log("added C " + x + "/" + howManyCurves);
          //console.log(c)
          i+=6;
        }
      }
      if (tok[i]=="c") {
        // The "c" command can take multiple curves in sequences, hence the while loop
        howManyCurves = (idxOfNextCommand - i-1)/ 6;
        console.assert(howManyCurves==Math.floor(howManyCurves));
        for (var x=0; x<howManyCurves; x++) {
          p1 = v.clone(); // Relative coordinate
          c1 = new THREE.Vector3(tok[i+1], tok[i+2], 0).add(v);
          c2 = new THREE.Vector3(tok[i+3], tok[i+4], 0).add(v);
          p2 = new THREE.Vector3(tok[i+5], tok[i+6], 0).add(v);
          c = new THREE.CubicBezierCurve3(p1, c1, c2, p2);
          v=p2.clone();
          //v = p2.clone();
          geometry.vertices = geometry.vertices.concat(c.getSpacedPoints ( opts.curveQuality ));
          //console.log("added c " + x + "/" + howManyCurves);
          //console.log(c);
          i+=6;
        }

      }
      if (tok[i]=="S" || tok[i]=="T") {
        console.error('SVG Simplified Beziers (S and T) commands are not currently supported');
        // Too lazy to implement this at the moment; this is a rare command I think
        //https://developer.mozilla.org/en/docs/Web/SVG/Tutorial/Paths#Bezier_Curves
      }
      if (tok[i]=="Q"){
        howManyCurves = (idxOfNextCommand - i-1)/ 4;
        for (var x=0; x<howManyCurves; x++) {
          c = new THREE.QuadraticBezierCurve3(
                      v.clone(),
                      new THREE.Vector3(tok[i+1], tok[i+2], 0),
                      new THREE.Vector3(tok[i+3], tok[i+4], 0)
                  );
          v = new THREE.Vector3(tok[i+3], tok[i+4], 0);
          geometry.vertices = geometry.vertices.concat(c.getSpacedPoints ( opts.curveQuality ));
          //console.log("added Q")
          //console.log(c)
          i+=4;
        }
      }
      if (tok[i]=="q"){
        howManyCurves = (idxOfNextCommand - i-1)/ 4;
        for (var x=0; x<howManyCurves; x++) {
          var p1 = v.clone();
          var p2 = new THREE.Vector3(tok[i+1], tok[i+2], 0).add(p1);
          var p3 = new THREE.Vector3(tok[i+3], tok[i+4], 0).add(p2);
          v = p3.clone();

          c = new THREE.QuadraticBezierCurve3(p1, p2, p3);
          geometry.vertices = geometry.vertices.concat(c.getSpacedPoints ( opts.curveQuality ));
          //console.log("added q")
          //console.log(c)
          i+=4;
        }

      }
      if (tok[i]=="Z" || tok[i]=="z"){
        // Draw line to start of path
        geometry.vertices.push(geometry.vertices[0].clone());
      }
    } // foreach token
    return geometry;
} // function svgPathToGeometry
*/


/*

function svgPathToGeometry(tok, opts){
    var geometry = new THREE.Geometry();
    var v = new THREE.Vector3(0,0,0);
    var c = null;
    var howManyCurves=0;
    var x;
    var p1, p2, c1, c2;

    for (var i=0; i<tok.length; i++){
      if (! (isFinite(tok[i]) || tok[i].search(/[mlhvcsqtaz]/i)>=0) ) {
        console.warn("Invalid item in tokenized SVG string: tok["+i+"]=" + tok[i] +"\nComplete string:\n"+tok.join(" "));
      }
    }

    for (var i=0; i<tok.length; i++){


      // Skip over all numeric values; we only care about finding commands
      if (isFinite(tok[i])) continue; 

      var idxOfNextCommand = i; 
      for (var j=i+1; j<tok.length; j++) { if (!isFinite(tok[j]))  {idxOfNextCommand=j; break; } }
      if (idxOfNextCommand==i) idxOfNextCommand = tok.length;

      if (tok[i]=="M"){
        v = new THREE.Vector3(tok[i+1], tok[i+2], 0);
        geometry.vertices.push(v.clone());
        if (i>0) console.warn('SVG path contains M commands after the first command. This is not yet supported and these M commands will be drawn as lines.');
      }
      if (tok[i]=="m"){
        v = new THREE.Vector3(tok[i+1], tok[i+2], 0).add(v);
        geometry.vertices.push(v.clone());
      }
      if (tok[i]=="L"){ // L commands can be followed by a number of x,y coordinate pairs
        howManyCurves = (idxOfNextCommand - i-1)/ 2;
        console.assert(howManyCurves==Math.floor(howManyCurves));
        for (var x=0,j=i+1; x<howManyCurves; x++) {
          v = new THREE.Vector3(tok[j++], tok[j++], 0);
          geometry.vertices.push(v.clone());
        }
      }
      if (tok[i]=="l"){ // L commands can be followed by a number of x,y coordinate pairs
        howManyCurves = (idxOfNextCommand - i-1)/ 2;
        console.assert(howManyCurves==Math.floor(howManyCurves));
        for (var x=0, j=i+1; x<howManyCurves; x++) {
          v = new THREE.Vector3(tok[j++], tok[j++], 0).add(v);
          geometry.vertices.push(v.clone());
        }
        //v = geometry.vertices[geometry.vertices.length-1];
      }
      if (tok[i]=="H") {
        v = new THREE.Vector3(tok[i+1], v.y, 0);
        geometry.vertices.push(v.clone());
      }
      if (tok[i]=="h") {
        v = new THREE.Vector3(tok[i+1] + v.x, v.y, 0);
        geometry.vertices.push(v.clone());
      }
      if (tok[i]=="V") {
        v = new THREE.Vector3(v.x, tok[i+1], 0);
        geometry.vertices.push(v.clone());
      }
      if (tok[i]=="v") {
        v = new THREE.Vector3(v.x, tok[i+1]+v.y, 0);
        geometry.vertices.push(v.clone());
      }
      if (tok[i]=="A"){
        console.assert(idxOfNextCommand == i+8,"SVG Parser cannot handle multiple A in a sequence");
        //f ction arcToSVG(x1, y1,    rx,       ry,       angle,   large_arc_flag, sweep_flag,   x2,       y2,     recursive) {
        var tmp = arcToSVG(v.x, v.y, tok[i+1], tok[i+2], tok[i+3], tok[i+4],        tok[i+5],   tok[i+6], tok[i+7]);
        i+=7;
        howManyCurves = tmp.length/ 6;
        for (var ii=0, jj=0; ii<howManyCurves; ii++){
          p1 = v.clone();
          c1 = new THREE.Vector3(tmp[jj++], tmp[jj++], 0);
          c2 = new THREE.Vector3(tmp[jj++], tmp[jj++], 0);
          p2 = new THREE.Vector3(tmp[jj++], tmp[jj++], 0);
          c = new THREE.CubicBezierCurve3(p1, c1, c2, p2);
          v=p2.clone();
          geometry.vertices = geometry.vertices.concat(c.getSpacedPoints ( opts.curveQuality ));
        }
      }
      if (tok[i]=="a"){
        console.assert(idxOfNextCommand == i+8,"SVG Parser cannot handle multiple A in a sequence");
        //f ction arcToSVG(x1, y1,    rx,       ry,       angle,   large_arc_flag, sweep_flag,   x2,       y2,               recursive) {
        var tmp = arcToSVG(v.x, v.y,  tok[i+1], tok[i+2], tok[i+3], tok[i+4],         tok[i+5],   tok[i+6]+v.x, tok[i+7]+v.y);
        howManyCurves = tmp.length/ 6;
        for (var ii=0, jj=0; ii<howManyCurves; ii++){
          p1 = v.clone();
          c1 = new THREE.Vector3(tmp[jj++], tmp[jj++], 0);
          c2 = new THREE.Vector3(tmp[jj++], tmp[jj++], 0);
          p2 = new THREE.Vector3(tmp[jj++], tmp[jj++], 0);
          c = new THREE.CubicBezierCurve3(p1, c1, c2, p2);
          v=p2.clone();
          geometry.vertices = geometry.vertices.concat(c.getSpacedPoints ( opts.curveQuality ));
        }
      }
      if (tok[i]=="C") {
        howManyCurves = (idxOfNextCommand - i-1)/ 6;
        console.assert(howManyCurves==Math.floor(howManyCurves));
        for (var x=0; x<howManyCurves; x++) {
          p1 = v.clone();
          c1 = new THREE.Vector3(tok[i+1], tok[i+2], 0);
          c2 = new THREE.Vector3(tok[i+3], tok[i+4], 0);
          p2 = new THREE.Vector3(tok[i+5], tok[i+6], 0);
          c = new THREE.CubicBezierCurve3(p1, c1, c2, p2);
          v=p2.clone();

          geometry.vertices = geometry.vertices.concat(c.getSpacedPoints ( opts.curveQuality ));
          //console.log("added C " + x + "/" + howManyCurves);
          //console.log(c)
          i+=6;
        }
      }
      if (tok[i]=="c") {
        // The "c" command can take multiple curves in sequences, hence the while loop
        howManyCurves = (idxOfNextCommand - i-1)/ 6;
        console.assert(howManyCurves==Math.floor(howManyCurves));
        for (var x=0; x<howManyCurves; x++) {
          p1 = v.clone(); // Relative coordinate
          c1 = new THREE.Vector3(tok[i+1], tok[i+2], 0).add(v);
          c2 = new THREE.Vector3(tok[i+3], tok[i+4], 0).add(v);
          p2 = new THREE.Vector3(tok[i+5], tok[i+6], 0).add(v);
          c = new THREE.CubicBezierCurve3(p1, c1, c2, p2);
          v=p2.clone();
          //v = p2.clone();
          geometry.vertices = geometry.vertices.concat(c.getSpacedPoints ( opts.curveQuality ));
          //console.log("added c " + x + "/" + howManyCurves);
          //console.log(c);
          i+=6;
        }

      }
      if (tok[i]=="S" || tok[i]=="T") {
        console.error('SVG Simplified Beziers (S and T) commands are not currently supported');
        // Too lazy to implement this at the moment; this is a rare command I think
        //https://developer.mozilla.org/en/docs/Web/SVG/Tutorial/Paths#Bezier_Curves
      }
      if (tok[i]=="Q"){
        howManyCurves = (idxOfNextCommand - i-1)/ 4;
        for (var x=0; x<howManyCurves; x++) {
          c = new THREE.QuadraticBezierCurve3(
                      v.clone(),
                      new THREE.Vector3(tok[i+1], tok[i+2], 0),
                      new THREE.Vector3(tok[i+3], tok[i+4], 0)
                  );
          v = new THREE.Vector3(tok[i+3], tok[i+4], 0);
          geometry.vertices = geometry.vertices.concat(c.getSpacedPoints ( opts.curveQuality ));
          //console.log("added Q")
          //console.log(c)
          i+=4;
        }
      }
      if (tok[i]=="q"){
        howManyCurves = (idxOfNextCommand - i-1)/ 4;
        for (var x=0; x<howManyCurves; x++) {
          var p1 = v.clone();
          var p2 = new THREE.Vector3(tok[i+1], tok[i+2], 0).add(p1);
          var p3 = new THREE.Vector3(tok[i+3], tok[i+4], 0).add(p2);
          v = p3.clone();

          c = new THREE.QuadraticBezierCurve3(p1, p2, p3);
          geometry.vertices = geometry.vertices.concat(c.getSpacedPoints ( opts.curveQuality ));
          //console.log("added q")
          //console.log(c)
          i+=4;
        }

      }
      if (tok[i]=="Z" || tok[i]=="z"){
        // Draw line to start of path
        geometry.vertices.push(geometry.vertices[0].clone());
      }
    } // foreach token
    return geometry;
} // function svgPathToGeometry
*/



// This function is ripped from
// github.com/DmitryBaranovskiy/raphael/blob/4d97d4/raphael.js#L2216-L2304
// which references w3.org/TR/SVG11/implnote.html#ArcImplementationNotes
// TODO: make it human readable

var π = Math.PI;
function __PRIVATE_radians(degress){
  return degress * (π / 180);
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

    f1 = x1 < cx ? π - f1 : f1;
    f2 = x2 < cx ? π - f2 : f2;
    if (f1 < 0) f1 = π * 2 + f1;
    if (f2 < 0) f2 = π * 2 + f2;
    if (sweep_flag && f1 > f2) f1 = f1 - π * 2;
    if (!sweep_flag && f2 > f1) f2 = f2 - π * 2;
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
