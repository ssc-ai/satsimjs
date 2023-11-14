SatSim JS
=========

SatSim source code was developed under contract with ARFL/RDSM, and is approved for public release under Public Affairs release approval #AFRL-2022-1116.

![screenshot](screenshot.jpg "screenshot")

## Installation from NPM

```sh
npm install satsim
```

## Usage

index.js

```javascript
import { Universe, createViewer } from "satsim";
import "cesium/Build/Cesium/Widgets/widgets.css";

const universe = new Universe();
const viewer = createViewer("cesiumContainer", universe);
```

index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
</head>
<body>
  <div id="cesiumContainer"></div>
</body>
</html>
```

## Example Webpack Application

```sh
git clone https://github.com/ssc-ai/satsimjs-example.git
cd satsimjs-example
npm install
npm start
```


## Example NextJS Application

```sh
git clone https://github.com/ssc-ai/satsimjs-nextjs-example.git
cd satsimjs-nextjs-example
npm install
npm run dev
```
