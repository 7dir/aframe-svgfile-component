// js import vs require
var parse = require('parse-svg-path');
var extract = require('extract-svg-path').parse;
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
    svgFile: {type: 'string', default: ''}
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
    var el = this.el;
    var meshData;

      load(data.svgFile, function(err, svg) {
        meshData = svgMesh3d(extract(svg), {
          delaunay: true,
          clean: true,
          exterior: false,
          randomization: 0,
          simplify: 0,
          scale: 1
        });
        this.geometry = createGeometry(meshData);
        this.material = new THREE.MeshStandardMaterial({ color: data.color, side: THREE.DoubleSide });// Create material.
        this.mesh = new THREE.Mesh(this.geometry, this.material);// Create mesh.
        el.setObject3D('mesh', this.mesh);// Set mesh on entity.
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
