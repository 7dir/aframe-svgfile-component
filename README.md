# aframe-svgfile-component

[demo aframe-svgfile-component](http://7dir.ru/aframe-svgfile-component/)

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
        <a-entity svgfile="svgFile: ../assets/github.svg; width:10; color: red" position="0 0 -3" rotation="0 0 0"></a-entity>
  </a-scene>
</body>
```

## API
Attribute | Description | Default
width | Optional. Width of the image, in AFrame units (meters). | Undefined
height | Optional. Height of the image in AFrame units. If only one of `height` or `width` is specified, the other will be set using the image aspect ratio | Undefined
color | Color to fill polygons with | #c23d3e
debug | Display wireframe instead of filled polygons? | false

Tip: You can force Illustrator to export to SVG using `<path>`s instead of `<polygon>`/`<circle>`/etc by selecting an object(s) and using "Make Compound Path" from the right-click context menu.

Tip: Turn on full-scene antialiasing to get smoother vector graphics: `<a-scene antialias="true" >`


### TODO
- [three.js mesh extrude](https://github.com/7dir/aframe-svgfile-component/issues/4)
- Add support for SVG elements aside from `<path>` (e.g. `<rect>`, `<polygon>`, `<circle>`, `<text>`)
- Support lines. Currently all <paths> are rendered as closed polygons.
- add support for SVG styles

### 


## License
MIT

