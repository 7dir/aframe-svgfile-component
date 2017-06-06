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

Specify `width` and/or `height` if you'd like the image rescaled from SVG units to AFrame scene size. Specify a `color:` or use the default dark grey (`#c23d3e`).

Tip: force Illustrator to export to SVG using `<path>` instead of `<polygon>` etc by selecting an object(s) and using "Make Compound Path" from the right-click context menu.

Tip: Turn on full-scene antialiasing to get smoother vector graphics: `<a-scene antialias="true" >`


### TODO
- [three.js mesh extrude](https://github.com/7dir/aframe-svgfile-component/issues/4)
- Add support for SVG elements aside from `<path>` (e.g. `<rect>`, `<polygon>`, `<circle>`, `<text>`)
- add support for SVG styles

### 


## License
MIT

