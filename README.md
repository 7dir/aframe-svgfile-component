# aframe-svgfile-component

U should understand how to create and use new AFRAME Component

Usage
```html
<!DOCTYPE html>
<html>
	<head>
		<title>My A-Frame Scene</title>
		<script src="https://aframe.io/releases/0.5.0/aframe.min.js"></script>
		<script src="aframe-svgfile-component.js"></script>
	</head>

<body>
  <a-scene>
        <a-entity svgfile="svgFile: ../assets/github.svg" position="0 0 -3" rotation="0 0 0"></a-entity>
  </a-scene>
</body>
```

Component source code
```js
AFRAME.registerComponent('svgpath', {
  schema: {
    color: {type: 'color', default: '#c23d3e'},
    svgPath: {type: 'string', default: 'M 15,1 29,37 H 15 L 1,1 Z'}
  },
  multiple: false,
  init: function () {
    var data = this.data;
    var el = this.el;
    var createGeometry = require('three-simplicial-complex')(THREE);
    var svgMesh3d = require('svg-mesh-3d');
    var meshData = svgMesh3d(data.svgPath, {
      delaunay: true,
      clean: true,
      exterior: false,
      randomization: 0,
      simplify: 0,
      scale: 1
    });
    this.geometry = createGeometry(meshData);
    this.material = new THREE.MeshStandardMaterial({ color: data.color });// Create material.
    this.mesh = new THREE.Mesh(this.geometry, this.material);// Create mesh.
    el.setObject3D('mesh', this.mesh);// Set mesh on entity.
  },
  update: function (oldData) { },
  remove: function () { },
  pause: function () { },
  play: function () { }
});
```

### TODO
- three.js mesh extrude

### 


## License
MIT

