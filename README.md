# aframe-svgfile-component

[demo aframe-svgfile-component](http://7dir.ru/aframe-svgfile-component/)

Use SVG files in an AFrame scene. Lines are rendered using THREE.MeshLine, and polygons are normal THREE geometry objects. Supports only quite simple SVG files at the moment.


## Usage
```html
<!DOCTYPE html>
<html>
	<head>
		<title>My A-Frame Scene</title>
		<script src="https://aframe.io/releases/0.5.0/aframe.min.js"></script>
		
		<script src="aframe-svgfile-component.js"></script>
	</head>

<body>
  <a-scene antialias="true">    
        <a-entity svgfile="svgFile: ../assets/github.svg; width:10; color: red" position="0 0 -3" rotation="0 0 0"></a-entity>
  </a-scene>
</body>
```

## API
Attribute | Description | Default
--- | --- | ---
width | Width of the image, in AFrame units (meters). | Undefined
height | Height of the image in AFrame units. If only one of `height` or `width` is specified, the other will be set using the image aspect ratio | Undefined
color | Color to fill polygons with | #c23d3e
debug | Display wireframe instead of filled polygons? | false
opacity | Controls opacity of entire image | 1
curveQuality | How many line segments per curve | 20
debug | Show wireframe mesh | false

Tip: Turn on full-scene antialiasing to get smoother vector graphics: `<a-scene antialias="true" >`

This component only supports farily simple SVG files. `path` and the geometric primitives are supported. `image` and `text` are not supported; these you should handle separately using AFrame's builtin image and text objects. 
Style support is very limited. The component tries to find the fill and stroke color, but it can only handle basic style attributes (like "fill" on a path) and does not read style or class information.

If width or height are not specified, the image will render using a 1:1 mapping from SVG units (pixels) to AFrame units (meters).



### TODO
- [three.js mesh extrude](https://github.com/7dir/aframe-svgfile-component/issues/4)
- Reduce dist/* filesize (improve use of uglifyify/babel/--exclude in build process)
- improve support for styles (fill and stroke stuff)

### 

Orignal by [7dir](http://github.com/7dir), extended by [morandd](http://github.com/morandd)


## License
MIT

