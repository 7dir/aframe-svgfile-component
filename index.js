// js import vs require
var load = require('load-svg');

var createGeometry = require('three-simplicial-complex')(THREE);
var svgMesh3d = require('svg-mesh-3d');

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
    svgFile: {type: 'string', default: ''},
    width: { type: 'number', default: NaN},
    height: { type: 'number', default: NaN},
    debug: {type: 'boolean', default: false} // Set to True to see wireframe
  },

  /**
   * Set if component needs multiple instancing.
   */
  multiple: true,

  /**
   * Called once when component is attached. Generally for initial setup.
   */
  init: function () {
    var data = this.data;
    var svgfileComponent = this;
    var el = this.el;
    var meshData;

      load(data.svgFile, function(err, svg) {

        function extractSVGPaths(svgDoc) {
            // concat all the <path> elements to form an SVG path string
            if (typeof svgDoc === 'string') {
            svgDoc = new DOMParser.parseFromString(svgDoc,"text/xml");
            }
            if (!svgDoc || typeof svgDoc.getElementsByTagName !== 'function') {
            throw new Error('could not get an XML document from the specified SVG contents');
            }

            if (svgDoc.getElementsByTagName('circle').length>0) console.warn("Only SVG <path>'s are supported; ignoring <circle> items");
            if (svgDoc.getElementsByTagName('rect').length>0) console.warn("Only SVG <path>'s are supported; ignoring <rect> items");
            if (svgDoc.getElementsByTagName('ellipse').length>0) console.warn("Only SVG <path>'s are supported; ignoring <ellipse> items");
            if (svgDoc.getElementsByTagName('image').length>0) console.warn("Only SVG <path>'s are supported; ignoring <image> items");
            if (svgDoc.getElementsByTagName('line').length>0) console.warn("Only SVG <path>'s are supported; ignoring <line> items");
            if (svgDoc.getElementsByTagName('text').length>0) console.warn("Only SVG <path>'s are supported; ignoring <text> items");
            if (svgDoc.getElementsByTagName('polygon').length>0) console.warn("Only SVG <path>'s are supported; ignoring <polygon> items");

            var paths = Array.prototype.slice.call(svgDoc.getElementsByTagName('path'));
            return paths.map(function (path) {
              return path.getAttribute('d').replace(/\s+/g, ' ').trim();
            });
        }
        var material = new THREE.MeshStandardMaterial({ wireframe: data.debug, color: data.color, side: THREE.DoubleSide });// Create material.
        var allPaths = extractSVGPaths(svg);

        // Find the image bounds, in SVG coordinate space
        var mins = [Infinity,Infinity,Infinity]; 
        var maxs = [-Infinity, -Infinity, -Infinity];

        for (var ii=0; ii<allPaths.length; ii++){
            meshData = svgMesh3d(allPaths[ii], {
              delaunay: true,
              clean: true,
              exterior: false,
              randomization: 0,
              normalize:false,
              simplify: 1,
              scale: 0
            });
            var geometry = createGeometry(meshData);
            for (var p in meshData.positions) {
              for (var k=0;k<=2; k++) {
                mins[k] = Math.min(mins[k], meshData.positions[p][k]);
                maxs[k] = Math.max(maxs[k], meshData.positions[p][k]);
              }
            }
            //this.material = new THREE.MeshStandardMaterial({ color: data.color, side: THREE.DoubleSide });// Create material.
            var mesh = new THREE.Mesh(geometry, material);// Create mesh.
            el.setObject3D('mesh'+ii, mesh);// Set mesh on entity.
        } // foreach path

        // Rescale geometry into AFrame units:
        // get image size in SVG units
        var width = maxs[0]-mins[0]; 
        var height = maxs[1]-mins[1]; 
        var aspectRatio = width/height;

        // Set Width or Height of AFrame entity if either width: or height: is specified by the user
        if (!isNaN(data.width) &&  isNaN(data.height)) data.height = data.width*aspectRatio;
        if (!isNaN(data.height) &&  isNaN(data.width)) data.width = data.height/aspectRatio;

        var scaleX = width / data.width;
        var scaleY = height / data.height;
        if (isNaN(data.width)) scaleX = 1;
        if (isNaN(data.height)) scaleY = 1;
        for (var meshname in el.object3DMap) {
            var verts = el.object3DMap[meshname].geometry.vertices;
            for (var vi=0; vi<verts.length; vi++) {
                verts[vi].x /= scaleX;
                verts[vi].y /= scaleY;
            }
        }


      });
    
  },



  /**
   * Called when component is attached and when component data changes.
   * Generally modifies the entity based on the data.
   */
  update: function (oldData) { },

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
  play: function () { }
});
