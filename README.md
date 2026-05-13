SatSim JS
=========

[![Tests](https://github.com/ssc-ai/satsimjs/actions/workflows/tests.yml/badge.svg)](https://github.com/ssc-ai/satsimjs/actions/workflows/tests.yml)

SatSim source code was developed under contract with AFRL/RDSM, and is approved for public release under Public Affairs release approval #AFRL-2022-1116.

![screenshot](screenshot.jpg "screenshot")

## Installation from NPM

```sh
npm install satsim
```

## Usage

### NPM Installation (Recommended)

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

### CDN Usage

For quick prototyping or when you don't want to set up a build system, you can use the CDN version:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>SatSim CDN Example</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- SatSim CDN (includes Cesium) -->
    <script src="https://unpkg.com/satsim@latest/dist/satsim.js"></script>
    <link href="https://unpkg.com/satsim@latest/dist/Widgets/widgets.css" rel="stylesheet">
    <style>
        html, body, #cesiumContainer {
            width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden;
        }
    </style>
</head>
<body>
    <div id="cesiumContainer"></div>
    <script>
        // Set Cesium base URL for assets
        window.CESIUM_BASE_URL = 'https://unpkg.com/satsim@latest/dist/';
        
        // Create universe and viewer
        const universe = new SatSim.Universe();
        const viewer = SatSim.createViewer('cesiumContainer', universe);        
    </script>
</body>
</html>
```

**Note:** The CDN file is approximately 4.4MB as it includes the entire Cesium library. For production applications, we recommend using the NPM version with a proper build system for better optimization and code splitting.

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

## Maintenance

Clean generated build output before rebuilding or preparing a release:

```sh
npm run clean
```

`npm run clean` removes `dist/` and `app/dist/`.

To bump the package version, use `npm version` so `package.json` and
`package-lock.json` stay in sync. For example:

```sh
npm version 0.15.2 --no-git-tag-version
npm test
npm run build
```

Use `npm version patch --no-git-tag-version` for the next patch version, or
replace `patch` with `minor` or `major` as needed. Commit the resulting
`package.json`, `package-lock.json`, generated build output if required for the
release, and any source changes together.

## Optional Runtime Layer

SatSim also includes an optional runtime foundation for applications that need
an authoritative simulation process with read-only or read/write clients.

Browser-safe imports:

```javascript
import { RuntimeClient, SessionManager, SimulationRuntime } from "satsim";
```

Node server import:

```javascript
import { HttpRuntimeServer } from "satsim/src/runtime/node.js";
```

The runtime API exposes scenario load/start/stop, snapshots, SSE state
streaming, ordered runtime events, and session-based write policies:
`multi`, `single`, or `readOnly`. Domain-specific protocol adapters should be
composed by the embedding application.

Command schemas and command-family behavior are documented in
[`docs/commands.md`](docs/commands.md).
