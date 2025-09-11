import { JulianDate, PointPrimitiveCollection, BillboardCollection, LabelCollection, Viewer, ImageryLayer, UrlTemplateImageryProvider, IonImageryProvider, buildModuleUrl, TileMapServiceImageryProvider, defined, Math as CMath, Cartesian2, Cartesian3, Matrix4, Color, SceneMode, ReferenceFrame, PostProcessStage, EntityView, Entity, Clock, Camera, SceneTransforms } from "cesium"
import { southEastZenithToAzEl } from "../engine/dynamics/gimbal.js"
import InfoBox from "./InfoBox.js"
import Toolbar from "./Toolbar.js"
import SensorFieldOfRegardVisualizer from "../engine/cesium/SensorFieldOfRegardVisualizer.js"
import SensorFieldOfViewVisualizer from "../engine/cesium/SensorFieldOfVIewVisualizer.js"
import GeoBeltVisualizer from "../engine/cesium/GeoBeltVisualizer.js"
import { createObjectPositionProperty, createObjectOrientationProperty, getObjectPositionInCesiumFrame } from "../engine/cesium/utils.js"
import ElectroOpicalSensor from "../engine/objects/ElectroOpticalSensor.js"
import CoverageGridVisualizer from "../engine/cesium/CoverageGridVisualizer.js"
import SimObject from "../engine/objects/SimObject.js"
import { CompoundElementVisualizer } from "../index.js"
import Observatory from "../engine/objects/Observatory.js"


/**
 * Create a new Cesium Viewer and mixin new capabilities.
 * 
 * @param {string | Element} container - The HTML container.
 * @param {Universe} universe - The SatSim Universe.
 * @param {*} options - Options
 * @returns {Viewer} - The new viewer instance.
 */
function createViewer(container, universe, options) {

  options = options ?? {}
  if (!defined(options.infoBox))
    options.infoBox = false

  if (!defined(options.geocoder))
    options.geocoder = false

  if (options.showLowResEarth) {
    options.baseLayer = ImageryLayer.fromProviderAsync(TileMapServiceImageryProvider.fromUrl(buildModuleUrl("Assets/Textures/NaturalEarthII")));
  }

  // Create Baseline Cesium Viewer
  const viewer = new Viewer(container, options)

  // Mixin new capabilities
  return mixinViewer(viewer, universe, options)
}

/**
 * Mixin new capabilities into the viewer.
 * 
 * @param {Viewer} viewer - The viewer to upgrade.
 * @param {Universe} universe - The universe.
 * @param {*} options - Options
 * @returns {Viewer} - The upgraded viewer instance.
 */
function mixinViewer(viewer, universe, options) {

  // Default options
  options = options ?? {}
  options.showNightLayer = options.showNightLayer ?? true
  options.showWeatherLayer = options.showWeatherLayer ?? true
  options.weatherApiKey = options.weatherApiKey ?? 'YOUR_API_KEY'
  options.infoBox2 = options.infoBox2 ?? true
  options.infoBox2Container = viewer._element ?? undefined
  options.toolbar2 = options.toolbar2 ?? true
  options.toolbar2Container = viewer._element ?? undefined
  // Enable built-in search override for simulation object names
  options.enableObjectSearch = options.enableObjectSearch ?? true

  // Viewer variables
  const scene = viewer.scene
  const layers = scene.imageryLayers
  const controller = scene.screenSpaceCameraController
  const camera = viewer.camera
  const selectionIndicator = viewer._selectionIndicator

  // Mixin variables
  viewer.referenceFrameView = ReferenceFrame.FIXED
  viewer.trackedSensor = null
  viewer.cameraMode = "world"
  viewer.sensorFovVisualizers = []
  viewer.sensorForVisualizers = []
  viewer.geoBeltVisualizer = new GeoBeltVisualizer(viewer)
  viewer.sensorGrids = []
  viewer.lastPicked = undefined
  viewer.billboards = scene.primitives.add(new BillboardCollection());
  viewer.points = scene.primitives.add(new PointPrimitiveCollection());
  viewer.labels = scene.primitives.add(new LabelCollection());
  viewer.coverageVisualizer = new CoverageGridVisualizer(viewer, universe);

  viewer.labelsAlwaysOn = false;
  // When global labels are ON in 3D, labels appear within this distance.
  // We also fade alpha from 0 -> 1 between fadeStart (5e6) and fadeEnd (4e6) meters.
  viewer.labelDistanceThresholdMeters = 5000000; // fadeStart (meters): label exists at/below this distance
  viewer.labelDistanceThresholdMetersSq = viewer.labelDistanceThresholdMeters * viewer.labelDistanceThresholdMeters;
  viewer.labelFadeOpaqueMeters = 4000000; // fadeEnd (meters): label fully opaque at/below this distance


  viewer.BILLBOARD_SATELLITE = viewer.billboards.add({
    show: false,
    image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAADJSURBVDhPnZHRDcMgEEMZjVEYpaNklIzSEfLfD4qNnXAJSFWfhO7w2Zc0Tf9QG2rXrEzSUeZLOGm47WoH95x3Hl3jEgilvDgsOQUTqsNl68ezEwn1vae6lceSEEYvvWNT/Rxc4CXQNGadho1NXoJ+9iaqc2xi2xbt23PJCDIB6TQjOC6Bho/sDy3fBQT8PrVhibU7yBFcEPaRxOoeTwbwByCOYf9VGp1BYI1BA+EeHhmfzKbBoJEQwn1yzUZtyspIQUha85MpkNIXB7GizqDEECsAAAAASUVORK5CYII="
  }).image
  viewer.BILLBOARD_GROUNDSTATION = viewer.billboards.add({
    show: false,
    image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACvSURBVDhPrZDRDcMgDAU9GqN0lIzijw6SUbJJygUeNQgSqepJTyHG91LVVpwDdfxM3T9TSl1EXZvDwii471fivK73cBFFQNTT/d2KoGpfGOpSIkhUpgUMxq9DFEsWv4IXhlyCnhBFnZcFEEuYqbiUlNwWgMTdrZ3JbQFoEVG53rd8ztG9aPJMnBUQf/VFraBJeWnLS0RfjbKyLJA8FkT5seDYS1Qwyv8t0B/5C2ZmH2/eTGNNBgMmAAAAAElFTkSuQmCC"
  }).image

  // Improved globe settings
  scene.globe.enableLighting = true
  scene.globe.lightingFadeInDistance = 0.0
  scene.globe.lightingFadeOutDistance = 0.0
  scene.globe.nightFadeInDistance = 10e10
  scene.globe.nightFadeOutDistance = 0
  scene.globe.brightness = 0.0
  scene.globe.dayAlpha = 0.0
  scene.globe.nightAlpha = 0.0
  scene.globe.dynamicAtmosphereLightingFromSun = true
  scene.globe.atmosphereLightIntensity = 3.0

  // Night layer
  if (options.showNightLayer) {
    const blackMarble = ImageryLayer.fromProviderAsync(
      IonImageryProvider.fromAssetId(3812)
    )
    blackMarble.dayAlpha = 0.0
    blackMarble.nightAlpha = 0.9
    blackMarble.brightness = 1.5
    layers.add(blackMarble)
  }

  // Openweathermap layer
  if (options.showWeatherLayer) {
    const weatherLayer = new ImageryLayer(new UrlTemplateImageryProvider({
      url: `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${options.weatherApiKey}`,
      maximumLevel: 3,
    }))
    weatherLayer.dayAlpha = 0.8
    weatherLayer.nightAlpha = 0.5
    layers.add(weatherLayer)
  }


  ///////////////////
  // Viewer Overrides
  ///////////////////

  /**
   * Add an onTick listener to fix point primitive tracking.
   * @param {Clock} clock 
   */
  const onTick = function (clock) {
    if (defined(viewer.cesiumWidget) && defined(viewer.cesiumWidget._trackedEntity)) {
      const trackedEntity = viewer.cesiumWidget._trackedEntity;
      if (defined(trackedEntity.point2)) { // fix for point primitive not tracking
        if (defined(viewer.cesiumWidget._entityView)) {
          viewer.cesiumWidget._entityView.update(clock.currentTime, viewer.boundingSphereScratch)
        }
      }
    }
  }
  viewer._eventHelper.add(viewer.clock.onTick, onTick, viewer);

  /**
   * Override the scene pick function.
   * @param {Cartesian2} windowPosition - The window position.
   * @param {number} [width] - Seems to always be undefined.
   * @param {number} [height] - Seems to always be undefined.
   * @returns {Entity} - The picked entity.
   */
  scene.pick = function (windowPosition, width, height) {

    if (viewer.cameraMode === "up") {
      // In What's Up, picking is handled by the 2D overlay; bypass Cesium picking.
      return undefined;
    }

    let e = this._picking.drillPick(this, windowPosition, 100, width, height)

    for (let i = 0; i < e.length; i++) {
      if (defined(e[i]) && defined(e[i].id)) {
        if (e[i].id.allowPicking !== false) {
          viewer.objectPickListener(e[i].id.simObjectRef, viewer.lastPicked)
          viewer.lastPicked = e[i].id.simObjectRef
          return e[i]
        } else if (e[i].collection === viewer.points) {
          viewer.objectPickListener(e[i].primitive.id.simObjectRef, viewer.lastPicked)
          viewer.lastPicked = e[i].primitive.id.simObjectRef
          return e[i].primitive
        }
      }
    }

    viewer.objectPickListener(undefined, viewer.lastPicked)
    viewer.lastPicked = undefined

    return undefined
  }

  // Setup new morph to 2D, mainly to disable visualizers that don't work in 2D
  const origMorphTo2D = scene.morphTo2D
  scene.morphTo2D = function (duration) {
    ecrButton.enable(false)
    sensorFieldOfRegardButton.enable(false)
    sensorFieldOfViewButton.enable(false)
    geoButton.enable(false)
    cameraViewMenu.enable(false)
    viewer.showVisual(viewer.geoBeltVisualizer, false)
    viewer.showVisual(viewer.sensorForVisualizers, false)
    viewer.showVisual(viewer.sensorFovVisualizers, false)
    viewer.setCameraMode("world")
    cameraViewMenu.selectedIndex = 0
    origMorphTo2D.call(scene, duration)
  }

  const origMorphToColumbusView = scene.morphToColumbusView
  scene.morphToColumbusView = function (duration) {
    ecrButton.enable(false)
    sensorFieldOfRegardButton.enable(false)
    sensorFieldOfViewButton.enable(false)
    geoButton.enable(false)
    cameraViewMenu.enable(false)
    viewer.showVisual(viewer.geoBeltVisualizer, false)
    viewer.showVisual(viewer.sensorForVisualizers, false)
    viewer.showVisual(viewer.sensorFovVisualizers, false)
    viewer.setCameraMode("world")
    cameraViewMenu.selectedIndex = 0
    origMorphToColumbusView.call(scene, duration)
  }

  ///////////////////
  // New Listeners
  ///////////////////

  function updateCamera(scene, time) {
    const camera = viewer.camera
    ecrButton.checked = viewer.referenceFrameView === ReferenceFrame.FIXED
    viewer._selectionIndicator = selectionIndicator

    // sensor and what's up view
    if (viewer.cameraMode === "sensor" || viewer.cameraMode === "up") {

      // scene.globe.show = false    
      scene.skyAtmosphere.show = false;
      scene.fog.enabled = false;
      scene.globe.showGroundAtmosphere = false;

      universe.earth.update(time, universe)
      viewer.trackedSensor.update(time, universe)

      const transform = new Matrix4()

      if (viewer.cameraMode === "sensor") {

        scene.skyBox.show = false;

        camera.direction = new Cartesian3(0, 0, -1);
        camera.right = new Cartesian3(1, 0, 0);
        camera.up = new Cartesian3(0, 1, 0);
        camera.position = new Cartesian3(0, 0, 0)

        Matrix4.multiply(universe.earth.worldToLocalTransform, viewer.trackedSensor.localToWorldTransform, transform)
        camera.frustum.fov = CMath.toRadians(viewer.trackedSensor.x_fov + viewer.trackedSensor.x_fov * 0.2)
      } else {

        // What's Up: 2D-only background (no 3D skybox or globe)
        scene.skyBox.show = false;

        camera.direction = new Cartesian3(0, 0, 1);
        camera.right = new Cartesian3(0, 1, 0);
        camera.up = new Cartesian3(-1, 0, 0);
        camera.position = new Cartesian3(0, 0, 0)

        Matrix4.multiply(universe.earth.worldToLocalTransform, viewer.trackedSensor.parent.parent.localToWorldTransform, transform)
        camera.frustum.fov = CMath.toRadians(160)
      }

      // the following lines are required to set the camera orientation
      Matrix4.multiplyByPoint(transform, camera.position, camera.positionWC)
      Matrix4.multiplyByPointAsVector(transform, camera.direction, camera.directionWC)
      Matrix4.multiplyByPointAsVector(transform, camera.up, camera.upWC)
      camera._setTransform(transform)

      // world view
    } else {

      scene.globe.show = true
      scene.skyAtmosphere.show = true;
      scene.fog.enabled = true;
      scene.globe.showGroundAtmosphere = true;
      scene.skyBox.show = true;

      // 2D modes
      if (scene.mode !== SceneMode.SCENE3D) {
        return
        // 3D mode
      } else {
        // ECI mode
        if (viewer.referenceFrameView === ReferenceFrame.INERTIAL) {
          viewer.trackedEntity = undefined // disable tracking, doesn't work in ECI
          const offset = Cartesian3.clone(camera.position)
          camera.lookAtTransform(universe.earth.worldToLocalTransform, offset)
        }
      }
    }
  }

  /**
   * Post update listener which adds new 3D perspectives and ECI mode.
   */
  scene.preRender.addEventListener(updateCamera)

  /**
   * Morph complete listener which enables/disables UI elements based on the mode.
   */
  scene.morphComplete.addEventListener(function () {
    // 2D mode
    if (scene.mode !== SceneMode.SCENE3D) {
      ecrButton.enable(false)
      sensorFieldOfRegardButton.enable(false)
      sensorFieldOfViewButton.enable(false)
      geoButton.enable(false)
      cameraViewMenu.enable(false)
      viewer.showVisual(viewer.geoBeltVisualizer, false)
      viewer.showVisual(viewer.sensorForVisualizers, false)
      viewer.showVisual(viewer.sensorFovVisualizers, false)
      // 3D mode
    } else {
      ecrButton.enable(true)
      sensorFieldOfRegardButton.enable(true)
      sensorFieldOfViewButton.enable(true)
      geoButton.enable(true)
      cameraViewMenu.enable(true)
      viewer.showVisual(viewer.geoBeltVisualizer, geoButton.checked)
      viewer.showVisual(viewer.sensorForVisualizers, sensorFieldOfRegardButton.checked)
      viewer.showVisual(viewer.sensorFovVisualizers, sensorFieldOfViewButton.checked)
    }

  })

  const lastUniverseUpdate = new JulianDate();
  let lastPickedUpdate = undefined

  /**
   * Check if the universe needs to be updated.
   */
  function isDirty(time, picked) {

    let dirty = false;
    if (Math.abs(JulianDate.secondsDifference(lastUniverseUpdate, time)) != 0) {
      JulianDate.clone(time, lastUniverseUpdate);
      dirty = true;
    }

    if (picked !== lastPickedUpdate) {
      lastPickedUpdate = picked;
      dirty = true;
    }

    return dirty;
  }

  /**
   * Pre update listener which updates the universe.
   */
  viewer.scene.preUpdate.addEventListener((scene, time) => {

    if (!isDirty(time, viewer.pickedObject)) {
      return;
    }

    universe.update(time)
  });


  ///////////////////
  // Viewer Mixins
  ///////////////////

  /**
   * Object pick listener. This should not be called directly.
   * 
   * @param {Element} picked - The picked element.
   * @param {Element} lastPicked - The last picked element.
   */
  viewer.objectPickListener = function (picked, lastPicked) {
  }

  /**
   * Add a sensor visualizer to the viewer.
   * 
   * @param {Site} site - The site.
   * @param {Gimbal} gimbal - The gimbal.
   * @param {ElectroOpicalSensor} sensor - The sensor.
   */
  viewer.addSensorVisualizer = function (site, gimbal, sensor) {
    const forViz = new SensorFieldOfRegardVisualizer(viewer, site, sensor, universe)
    forViz.show = false
    viewer.sensorForVisualizers.push(forViz)
    sensor.visualizer.fieldOfRegard = forViz

    const fovViz = new SensorFieldOfViewVisualizer(viewer, site, gimbal, sensor, universe)
    viewer.sensorFovVisualizers.push(fovViz)
    sensor.visualizer.fieldOfView = fovViz

    toolbar.addToolbarMenu([
      {
        text: "Sensor View @ " + sensor.name,
        onselect: function () {
          viewer.setCameraMode("sensor", sensor)
        },
      },
      {
        text: "What's Up View @ " + sensor.name,
        onselect: function () {
          viewer.setCameraMode("up", sensor)
        },
      },
    ], cameraViewMenu)

    // Grid for what's up view (associate with this sensor)
    const grid = viewer.entities.add({
      name: sensor.name + ' grid ',
      position: createObjectPositionProperty(site, universe, viewer),
      orientation: createObjectOrientationProperty(site, universe),
      ellipsoid: {
        radii: new Cartesian3(1000000, 1000000, 1000000),
        material: Color.WHITE.withAlpha(0.0),
        outlineColor: Color.WHEAT.withAlpha(0.25),
        outline: true,
        slicePartitions: 36,
        stackPartitions: 18
      },
      show: false,
      allowPicking: false
    })
    grid.sensorRef = sensor
    viewer.sensorGrids.push(grid)
  };

  /**
   * Add a site visualizer to the viewer.
   * @param {SimObject} site 
   * @param {string} description 
   * @param {Entity} options 
   */
  viewer.addSiteVisualizer = function (site, description, options) {
    const base = {
      name: site.name,
      description: description,
      position: createObjectPositionProperty(site, universe, viewer),
      orientation: createObjectOrientationProperty(site, universe),
      simObjectRef: site
    }

    const entity = viewer.entities.add(Object.assign(base, options))
    site.visualizer = entity
  }

  /**
   * Add an observatory visualizer to the viewer.
   * @param {Observatory} observatory 
   * @param {string} description 
   */
  viewer.addObservatoryVisualizer = function (observatory, description) {
    viewer.addSiteVisualizer(observatory.site, description, {
      billboard: {
        image: viewer.BILLBOARD_GROUNDSTATION,
        disableDepthTestDistance: 2000000,
        show: true
      },
      simObjectRef: observatory
    })
    viewer.addSensorVisualizer(observatory.site, observatory.gimbal, observatory.sensor)
  }

  /**
   * Add a satellite visualizer to the viewer.
   * @param {SimObject} object 
   * @param {string} description 
   * @param {Entity} options 
   * @param {boolean} isStatic 
   */
  viewer.addObjectVisualizer = function (object, description, options, isStatic = false) {

    // clear point object to be added to point collection for 2-3x better performance
    const point = options.point
    options.point = undefined

    // create base entity which uses the traditional object position callback
    const base = {
      name: object.name,
      description: description,
      position: isStatic ? object.position : createObjectPositionProperty(object, universe, viewer),
      simObjectRef: object,
      allowPicking: true
    }
    const entity = viewer.entities.add(Object.assign(base, options))

    // create new point primitive
    if (defined(point)) {
      entity.point2 = viewer.points.add(point)
      entity.point2.id = entity  // required for picking
      entity.update = function (time, universe) {
        entity.point2.position = getObjectPositionInCesiumFrame(viewer, universe, object, time)
      }
      object.visualizer = entity
      object.updateListeners.push(entity);
    }
  }

  /**
   * Set the camera mode.
   * 
   * @param {string} mode - The camera mode. "world", "sensor", "up".
   * @param {ElectroOpicalSensor} sensor - The sensor.
   */
  viewer.setCameraMode = function (mode, sensor) {

    if (mode === "up") {
      viewer.resolutionScale = 3.0;
    } else {
      viewer.resolutionScale = 1.0;
    }

    // save camera position
    if (viewer.cameraMode === "world") {
      originalCameraState = getCameraState();
    }

    if (mode === "sensor" || mode === "up") {
      viewer.selectedEntity = undefined;
      viewer.trackedEntity = undefined;

      controller.update = function () { };
      controller.enableTranslate = false;
      controller.enableZoom = false;
      controller.enableRotate = false;
      controller.enableTilt = false;
      controller.enableLook = false;
      viewer.trackedSensor = sensor;

    } else if (mode === "world") {
      setCameraState(originalCameraState);
      camera.flyHome();
    } else {
      console.log('unknown camera mode: ' + mode);
      return;
    }

    // Disable 3D grid visuals; we'll draw 2D rings/spokes instead in overlay
    viewer.sensorGrids.forEach(function (v) {
      v.show = false;
    });

    viewer.sensorForVisualizers.forEach(function (v) {
      v.outline = mode === "world";
    });

    viewer.sensorFovVisualizers.forEach(function (v) {
      v.outline = mode === "world";
    });

    // Hide Cesium point sprites in "up" mode (we draw a 2D overlay instead)
    if (mode === "up") {
      viewer._prevPointsVisible = viewer.points.show;
      viewer.points.show = false;
      // Hide label collection in up mode to avoid distorted 3D labels
      viewer._prevLabelsVisible = viewer.labels.show;
      viewer.labels.show = false;
      // Also hide Cesium's default selection indicator (misaligned due to post-process warp)
      try {
        const selEl = viewer._element.querySelector('.cesium-selection-wrapper');
        if (selEl) selEl.style.display = 'none';
      } catch (e) { /* ignore */ }
    } else if (mode === "world") {
      // Restore previous points, and apply global labels flag for label collection
      const prev = viewer._prevPointsVisible;
      viewer.points.show = (prev === undefined) ? true : prev;
      viewer.labels.show = !!viewer.labelsOn;
      // Restore selection indicator visibility
      try {
        const selEl = viewer._element.querySelector('.cesium-selection-wrapper');
        if (selEl) selEl.style.display = '';
      } catch (e) { /* ignore */ }
    }

    viewer.cameraMode = mode;
    updateCamera(scene, viewer.clock.currentTime);
  };

  /**
   * Set the default selected toolbar.
   * @param {Toolbar} toolbar 
   * @param {Entity} entity
   */
  viewer.applyDefaultToolbar = function (toolbar, entity) {
    if (defined(entity) && defined(entity.simObjectRef)) {
      const obj = entity.simObjectRef
      if (obj instanceof Observatory) {
        toolbar.addToggleButton('Field of Regard', obj.sensor.visualizer.fieldOfRegard.show, (checked) => {
          obj.sensor.visualizer.fieldOfRegard.show = checked
        });
        toolbar.addToggleButton('Field of View', obj.sensor.visualizer.fieldOfView.show, (checked) => {
          obj.sensor.visualizer.fieldOfView.show = checked
        });
      } else if (universe._trackables.includes(obj)) {
        toolbar.addToggleButton('Path', obj.visualizer.path.show.getValue(), (checked) => {
          obj.visualizer.path.show = checked
        });
        const labelOn = obj.visualizer.label2?.show
        toolbar.addToggleButton('Label', labelOn, (checked) => {

          // create label if missing
          if (!defined(obj.visualizer.label2)) {
            obj.visualizer.label2 = viewer.labels.add({
              text: obj.name,
              font: '14px sans-serif',
            })
            obj.visualizer.label2.id = entity  // required for picking
            obj.visualizer.label2.update = function (time, universe) {
              obj.visualizer.label2.position = getObjectPositionInCesiumFrame(viewer, universe, obj, time)
              // When global labels are ON in 3D, apply distance fade 5e6->4e6 m
              if (viewer.labelsOn && viewer.cameraMode !== 'up') {
                try {
                  const camPos = viewer.camera.positionWC;
                  const p = obj.visualizer.label2.position;
                  if (camPos && p) {
                    const d2 = Cartesian3.distanceSquared(camPos, p);
                    const inRange = d2 < viewer.labelDistanceThresholdMetersSq;
                    obj.visualizer.label2.show = inRange;
                    if (inRange) {
                      const fadeStart = viewer.labelDistanceThresholdMeters;
                      const fadeEnd = Math.max(0, viewer.labelFadeOpaqueMeters || 4000000);
                      const fadeSpan = Math.max(1e-6, fadeStart - fadeEnd);
                      const dist = Math.sqrt(d2);
                      let alpha = 1.0;
                      if (dist >= fadeStart) alpha = 0.0;
                      else if (dist <= fadeEnd) alpha = 1.0;
                      else alpha = (fadeStart - dist) / fadeSpan;
                      try { obj.visualizer.label2.fillColor = Color.WHITE.withAlpha(alpha); } catch (e) { /* ignore */ }
                    }
                  }
                } catch (e) { /* ignore */ }
              }
            }
            obj.visualizer.label2.show = checked
            try { obj.visualizer.label2.position = getObjectPositionInCesiumFrame(viewer, universe, obj, viewer.clock.currentTime) } catch (e) { /* ignore */ }
            obj.updateListeners.push(obj.visualizer.label2);
          } else {
            obj.visualizer.label2.show = checked
          }
        });
      }
    }
  }

  viewer.generateDefaultDynamicDescription = function (entity) {
    if (defined(entity) && defined(entity.simObjectRef)) {
      const obj = entity.simObjectRef
      obj.update(universe.clock.currentTime, universe)
      return obj.position.toString() + '<br>' + obj.velocity.toString()
    }
    return ""
  }

  /**
   * Shows or hides the visualizer(s).
   * 
   * @param {CompoundElementVisualizer} visualizer - The visualizer or array of visualizers.
   * @param {boolean} show - True to show, false to hide.
   */
  viewer.showVisual = function (visualizer, show) {

    if (defined(visualizer.length)) {
      visualizer.forEach(v => {
        v.show = show;
      });
    } else {
      visualizer.show = show;
    }
  };

  /**
   * Enable/disable all labels globally by toggling each trackable's label2.
   * If a label doesn't exist yet, create it and hook up position updates.
   * @param {boolean} enabled
   */
  viewer.setAllLabelsEnabled = function (enabled) {
    viewer.labelsOn = !!enabled;
    try { viewer.labels.show = viewer.cameraMode !== 'up'; } catch (e) { /* ignore */ }

    if (!viewer.labelsOn) {
      // Remove all existing labels to free primitives
      const sats = universe._trackables || [];
      for (let i = 0; i < sats.length; i++) {
        const obj = sats[i];
        const entity = obj && obj.visualizer;
        if (!entity || !entity.label2) continue;
        const lbl = entity.label2;
        if (Array.isArray(obj.updateListeners)) {
          const idx = obj.updateListeners.indexOf(lbl);
          if (idx !== -1) obj.updateListeners.splice(idx, 1);
        }
        try { viewer.labels.remove(lbl); } catch (e) { /* ignore */ }
        entity.label2 = undefined;
      }
    }
  };

  // Dynamic label culling/creation each tick when global labels are ON
  const dynamicLabelTick = function () {
    if (!viewer.labelsOn || viewer.cameraMode === 'up') return;
    const camPos = viewer.camera.positionWC;
    if (!camPos) return;
    const sats = universe._trackables || [];
    const fadeStart = viewer.labelDistanceThresholdMeters; // 5e6
    const fadeEnd = Math.max(0, viewer.labelFadeOpaqueMeters || 4000000); // 4e6 default
    const fadeSpan = Math.max(1e-6, fadeStart - fadeEnd);
    for (let i = 0; i < sats.length; i++) {
      const obj = sats[i];
      const entity = obj && obj.visualizer;
      if (!entity) continue;
      let lbl = entity.label2;
      // Compute (or reuse) position
      let pos;
      try { pos = getObjectPositionInCesiumFrame(viewer, universe, obj, viewer.clock.currentTime); } catch (e) { continue; }
      const d2 = Cartesian3.distanceSquared(camPos, pos);
      const inRange = d2 < viewer.labelDistanceThresholdMetersSq; // within fadeStart
      if (inRange) {
        const dist = Math.sqrt(d2);
        let alpha = 1.0;
        if (dist >= fadeStart) {
          alpha = 0.0;
        } else if (dist <= fadeEnd) {
          alpha = 1.0;
        } else {
          alpha = (fadeStart - dist) / fadeSpan; // 0..1
        }
        if (!lbl) {
          lbl = viewer.labels.add({ text: obj.name, font: '14px sans-serif', show: true, fillColor: Color.WHITE.withAlpha(alpha) });
          lbl.id = entity;
          lbl.position = pos;
          lbl.update = function (time, uni) {
            try {
              lbl.position = getObjectPositionInCesiumFrame(viewer, uni || universe, obj, time || viewer.clock.currentTime);
            } catch (e) { /* ignore */ }
          };
          entity.label2 = lbl;
          if (Array.isArray(obj.updateListeners)) obj.updateListeners.push(lbl);
        } else {
          lbl.position = pos;
          try { lbl.fillColor = Color.WHITE.withAlpha(alpha); } catch (e) { /* ignore */ }
          lbl.show = true;
        }
      } else if (lbl) {
        // Out of range: remove
        if (Array.isArray(obj.updateListeners)) {
          const idx = obj.updateListeners.indexOf(lbl);
          if (idx !== -1) obj.updateListeners.splice(idx, 1);
        }
        try { viewer.labels.remove(lbl); } catch (e) { /* ignore */ }
        entity.label2 = undefined;
      }
    }
  };
  viewer._eventHelper.add(viewer.clock.onTick, dynamicLabelTick, viewer);




  ///////////////////
  // UI Widgets
  ///////////////////

  // Improved Infobox
  if (options.infoBox2) {
    const infoBoxContainer = document.createElement("div");
    infoBoxContainer.className = "cesium-viewer-infoBoxContainer";
    options.infoBox2Container.appendChild(infoBoxContainer);
    const infoBox = new InfoBox(infoBoxContainer, viewer, universe);

    const infoBoxViewModel = infoBox.viewModel;
    viewer._eventHelper.add(
      infoBoxViewModel.cameraClicked,
      (infoBoxViewModel) => {
        viewer.referenceFrameView = ReferenceFrame.FIXED;
        if (
          infoBoxViewModel.isCameraTracking &&
          viewer.trackedEntity === viewer.selectedEntity
        ) {
          viewer.trackedEntity = undefined;
        } else {
          const selectedEntity = viewer.selectedEntity;
          const position = selectedEntity.position;
          if (defined(position)) {
            viewer.trackedEntity = viewer.selectedEntity;
          } else {
            viewer.zoomTo(viewer.selectedEntity);
          }
        }
      },
      this
    );
    viewer._eventHelper.add(
      infoBoxViewModel.closeClicked,
      () => { viewer.selectedEntity = undefined; },
      this
    );
    viewer._infoBox = infoBox;
  }

  // Toolbar
  const toolbarContainer = document.createElement('div');
  toolbarContainer.classname = "cesium-viewer-actionbar";
  toolbarContainer.style.position = 'absolute';
  toolbarContainer.style.top = '10px';
  toolbarContainer.style.left = '10px';
  if (options.toolbar2) {
    options.toolbar2Container.appendChild(toolbarContainer);
  }
  const toolbar = new Toolbar(toolbarContainer);
  viewer.toolbar = toolbar;
  const ecrButton = toolbar.addToggleButton('ECR', true, (checked) => {
    if (!checked) {
      viewer.referenceFrameView = ReferenceFrame.INERTIAL;
    } else {
      viewer.referenceFrameView = ReferenceFrame.FIXED;
    }
  });
  const sensorFieldOfRegardButton = toolbar.addToggleButton('FoR', false, (checked) => {
    viewer.showVisual(viewer.sensorForVisualizers, checked);
  });
  const sensorFieldOfViewButton = toolbar.addToggleButton('FoV', true, (checked) => {
    viewer.showVisual(viewer.sensorFovVisualizers, checked);
  });
  const geoButton = toolbar.addToggleButton('GEO', true, (checked) => {
    viewer.showVisual(viewer.geoBeltVisualizer, checked);
  });
  const satButton = toolbar.addToggleButton('Satellites', true, (checked) => {
    viewer.points.show = checked;
  });
  const labelsButton = toolbar.addToggleButton('Labels', false, (checked) => {
    viewer.setAllLabelsEnabled(checked);
  });
  // (2D-only Up toggle removed; What's Up is always 2D-only)
  toolbar.addSeparator();
  const cameraViewMenu = toolbar.addToolbarMenu([
    {
      text: "World View",
      onselect: function () {
        viewer.setCameraMode("world");
      }
    }
  ]);
  const coverageMenu = toolbar.addToolbarMenu([
    {
      text: "No Coverage Map",
      onselect: function () {
        viewer.coverageVisualizer.show = false;
      },
    },
    {
      text: "LEO Coverage Map",
      onselect: function () {
        viewer.coverageVisualizer.orbit = 'LEO';
        viewer.coverageVisualizer.show = true;
        viewer.coverageVisualizer.update(viewer.clock.currentTime)
      },
    },
    {
      text: "MEO Coverage Map",
      onselect: function () {
        viewer.coverageVisualizer.orbit = 'MEO';
        viewer.coverageVisualizer.show = true;
        viewer.coverageVisualizer.update(viewer.clock.currentTime)
      },
    },
    {
      text: "GEO Coverage Map",
      onselect: function () {
        viewer.coverageVisualizer.orbit = 'GEO';
        viewer.coverageVisualizer.show = true;
        viewer.coverageVisualizer.update(viewer.clock.currentTime)
      },
    },
    {
      text: "Lunar Coverage Map",
      onselect: function () {
        viewer.coverageVisualizer.orbit = 'LUNAR';
        viewer.coverageVisualizer.show = true;
        viewer.coverageVisualizer.update(viewer.clock.currentTime)
      },
    },
  ]);

  // (Fudge slider and mode menu removed)



  ///////////////////
  // Misc
  ///////////////////
  let originalCameraState = getCameraState();
  function getCameraState() {
    return {
      update: scene.screenSpaceCameraController.update,
      enableTranslate: controller.enableTranslate,
      enableZoom: controller.enableZoom,
      enableRotate: controller.enableRotate,
      enableTilt: controller.enableTilt,
      enableLook: controller.enableLook,
      fov: camera.frustum.fov,
      direction: Cartesian3.clone(camera.direction),
      right: Cartesian3.clone(camera.right),
      up: Cartesian3.clone(camera.up),
      position: Cartesian3.clone(camera.position),
      transform: Matrix4.clone(camera.transform)
    };
  }

  function setCameraState(state) {
    camera.frustum.fov = state.fov;
    Cartesian3.clone(state.direction, camera.direction);
    Cartesian3.clone(state.right, camera.right);
    Cartesian3.clone(state.up, camera.up);
    Cartesian3.clone(state.position, camera.position);
    Matrix4.clone(state.transform, camera.transform);
    controller.update = state.update;
    controller.enableTranslate = state.enableTranslate;
    controller.enableZoom = state.enableZoom;
    controller.enableRotate = state.enableRotate;
    controller.enableTilt = state.enableTilt;
    controller.enableLook = state.enableLook;
  }

  // Post process stage: in What's Up mode, blank the 3D background so only the 2D overlay is visible.
  const fs = `
uniform sampler2D colorTexture;
uniform float fov;           // kept for compatibility (unused when blanking)
uniform int mode;            // 0 = What's Up (blank), 1 = pass-through
uniform float aspectRatio;   // kept for compatibility (unused when blanking)
in vec2 v_textureCoordinates; // input coord is 0..1

  // In What's Up mode, fully disable 3D by outputting a solid background.
void main (void)
{
    // mode == 0 => What's Up (blank background)
    if (mode == 0) {
      out_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    // mode == 1 => pass-through (normal 3D rendering)
    out_FragColor = texture(colorTexture, v_textureCoordinates);
  }
`;

  scene.postProcessStages.add(new PostProcessStage({
    fragmentShader: fs,
    uniforms: {
      fov: function () {
        return defined(camera.frustum.fov) ? camera.frustum.fov : 0.0;
      },
      mode: function () {
        // In What's Up, always blank the 3D background (2D-only)
        if (viewer.cameraMode === "up") return 0;
        return 1;
      },
      aspectRatio: function () {
        const dbw = scene.context?.drawingBufferWidth;
        const dbh = scene.context?.drawingBufferHeight;
        return (dbw && dbh) ? (dbw / dbh) : camera.frustum.aspectRatio;
      },
    }
  }));

  ///////////////////
  // "What's Up" 2D Overlay (preserve round dots)
  ///////////////////

  // Create overlay canvas above Cesium canvas
  function ensureUpOverlay() {
    if (viewer._upOverlayCanvas) return;
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none'; // let clicks fall through unless we capture them
    canvas.style.zIndex = 10;
    viewer._element.appendChild(canvas);
    viewer._upOverlayCanvas = canvas;
    viewer._upOverlayCtx = canvas.getContext('2d');

    // Click picking: capture on container so non-hits pass through to widgets
    function handleOverlayPick(ev) {
      if (viewer.cameraMode !== 'up') return;
      const res = pickUpOverlayAt(ev.clientX, ev.clientY);
      if (res) {
        viewer.selectedEntity = res.entity;
        viewer.objectPickListener(res.sat, viewer.lastPicked);
        viewer.lastPicked = res.sat;
        viewer.pickedObject = res.sat;
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation?.();
      } else {
        viewer.pickedObject = undefined;
      }
      // else: let clicks continue to underlying widgets
    }

    const onPointerDownCapture = (ev) => handleOverlayPick(ev);
    const onClickCapture = (ev) => handleOverlayPick(ev);

    viewer._element.addEventListener('pointerdown', onPointerDownCapture, { capture: true, passive: false });
    viewer._element.addEventListener('click', onClickCapture, { capture: true, passive: false });
    viewer._element.addEventListener('touchstart', (e) => {
      if (viewer.cameraMode !== 'up') return;
      if (e.touches && e.touches.length) {
        const t = e.touches[0];
        // Synthesize event-like object for unified handling
        handleOverlayPick({ clientX: t.clientX, clientY: t.clientY, preventDefault: () => e.preventDefault(), stopPropagation: () => e.stopPropagation(), stopImmediatePropagation: () => { } });
      }
    }, { capture: true, passive: false });
  }

  function resizeUpOverlay() {
    if (!viewer._upOverlayCanvas) return;
    const canvas = viewer._upOverlayCanvas;
    const dpr = window.devicePixelRatio || 1;
    const w = viewer._element.clientWidth | 0;
    const h = viewer._element.clientHeight | 0;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = Math.max(1, w * dpr);
      canvas.height = Math.max(1, h * dpr);
    }
    const ctx = viewer._upOverlayCtx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
  }

  function drawUpOverlay(time) {
    if (viewer.cameraMode !== 'up') {
      if (viewer._upOverlayCanvas) {
        const ctx = viewer._upOverlayCtx;
        if (ctx) {
          ctx.clearRect(0, 0, viewer._element.clientWidth, viewer._element.clientHeight);
        }
      }
      return;
    }
    ensureUpOverlay();
    resizeUpOverlay();
    const canvas = viewer._upOverlayCanvas;
    const ctx = viewer._upOverlayCtx;
    const w = viewer._element.clientWidth | 0;
    const h = viewer._element.clientHeight | 0;
    ctx.clearRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.5;
    const aspect = w / Math.max(1, h);
    const radiusPx = 0.5 * Math.min(w, h); // always inscribed

    // Lens: equidistant (linear in zenith) for overlay
    const thetaMax = viewer.camera.frustum.fov * 0.5;

    // Camera basis and position in world coordinates
    const f = viewer.camera.directionWC;
    const u = viewer.camera.upWC;
    const r = viewer.camera.rightWC;
    const cpos = viewer.camera.positionWC;

    // Optionally render a faint boundary
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Always show cardinal axes and elevation labels (no rings)
    drawUpGrid(ctx, cx, cy, radiusPx, viewer.camera.frustum.fov);

    // Draw 2D paths (trail/lead) for satellites if enabled
    // Note: We sample along the entity path's lead/trail time and project with the same equidistant mapping.
    const sats = universe._trackables || [];
    const now = time;
    for (let i = 0; i < sats.length; i++) {
      const sat = sats[i];
      const v = sat.visualizer;
      if (!v || !v.path) continue;
      // Check if path is enabled
      let showPath = false;
      try {
        const sp = v.path.show;
        showPath = !!(sp && typeof sp.getValue === 'function' ? sp.getValue(now) : sp);
      } catch (e) { /* ignore */ }
      if (!showPath) continue;

      // Read path parameters with safe fallbacks
      const getVal = (p, def) => {
        try { return (p && typeof p.getValue === 'function') ? p.getValue(now) : (p ?? def); } catch (e) { return def; }
      };
      const leadSec = Math.max(0, getVal(v.path.leadTime, 0));
      const trailSec = Math.max(0, getVal(v.path.trailTime, 0));
      let stepSec = Math.max(1, getVal(v.path.resolution, 30));
      const maxSamples = 300; // cap for performance per satellite
      const totalSec = leadSec + trailSec;
      const estSamples = Math.ceil(totalSec / stepSec) + 1;
      if (estSamples > maxSamples && totalSec > 0) {
        stepSec = Math.max(stepSec, totalSec / maxSamples);
      }

      // Stroke style from point color, dimmed alpha for path
      let pathStroke = 'rgba(255,255,255,0.35)';
      let width = Math.max(0.75, getVal(v.path.width, 1));
      try {
        const col = v.point2 && (v.point2.color && (v.point2.color._value || v.point2.color));
        if (col && typeof col.withAlpha === 'function' && typeof col.toCssColorString === 'function') {
          pathStroke = col.withAlpha(0.35).toCssColorString();
        }
      } catch (e) { /* ignore */ }

      ctx.save();
      ctx.lineWidth = width;
      ctx.strokeStyle = pathStroke;

      // Sample from -trail to +lead relative to now
      let started = false;
      let open = false;
      const jdScratch = new JulianDate();
      const startOffset = -trailSec;
      const endOffset = leadSec;
      for (let dt = startOffset; dt <= endOffset + 1e-6; dt += stepSec) {
        const tSample = JulianDate.addSeconds(now, dt, jdScratch);
        // Update sat to sample time and project
        sat.update(tSample, universe);
        const spos = getObjectPositionInCesiumFrame(viewer, universe, sat, tSample);
        const vx = spos.x - cpos.x;
        const vy = spos.y - cpos.y;
        const vz = spos.z - cpos.z;
        const len = Math.hypot(vx, vy, vz);
        if (len === 0) { if (open) { ctx.stroke(); open = false; } started = false; continue; }
        const nx = vx / len, ny = vy / len, nz = vz / len;
        const dx = nx * r.x + ny * r.y + nz * r.z;
        const dy = nx * u.x + ny * u.y + nz * u.z;
        const dz = nx * f.x + ny * f.y + nz * f.z;
        if (dz <= 0.0) { if (open) { ctx.stroke(); open = false; } started = false; continue; }
        const theta = Math.acos(Math.min(1.0, Math.max(-1.0, dz)));
        if (theta > thetaMax) { if (open) { ctx.stroke(); open = false; } started = false; continue; }
        // Map to overlay
        const rLin = Math.min(1.0, Math.max(0.0, theta / thetaMax));
        const alpha = Math.atan2(dx, dy);
        const px = cx + radiusPx * rLin * Math.sin(alpha);
        const py = cy - radiusPx * rLin * Math.cos(alpha);
        if (!started) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          started = true; open = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
      if (open) { ctx.stroke(); open = false; }
      ctx.restore();
    }

    // Draw satellites, map to normalized polar, and optionally annotate az/el
    // (reuse sats array)
    viewer._upOverlayHits = [];
    let selPx = undefined, selPy = undefined, selR = undefined;
    for (let i = 0; i < sats.length; i++) {
      const sat = sats[i];
      // Keep simulation and overlay in sync
      sat.update(time, universe);
      const spos = getObjectPositionInCesiumFrame(viewer, universe, sat, time);
      const vx = spos.x - cpos.x;
      const vy = spos.y - cpos.y;
      const vz = spos.z - cpos.z;
      const len = Math.hypot(vx, vy, vz);
      if (len === 0) continue;
      const nx = vx / len, ny = vy / len, nz = vz / len;
      // Project into camera world basis
      const dx = nx * r.x + ny * r.y + nz * r.z;
      const dy = nx * u.x + ny * u.y + nz * u.z;
      const dz = nx * f.x + ny * f.y + nz * f.z;
      if (dz <= 0.0) continue; // behind

      const theta = Math.acos(Math.min(1.0, Math.max(-1.0, dz))); // angle from forward
      if (theta > thetaMax) continue; // outside FOV

      // Normalized polar mapping (equidistant): r = theta / thetaMax (no 2D fudge)
      let rLin = Math.min(1.0, Math.max(0.0, theta / thetaMax));
      // angle measured clockwise from North: alpha = atan2(East, North) = atan2(dx, dy)
      const alpha = Math.atan2(dx, dy);
      // Overlay uses pixel circle of radius w/2; no extra Y scaling
      const px = cx + radiusPx * rLin * Math.sin(alpha);
      const py = cy - radiusPx * rLin * Math.cos(alpha);

      // Skip drawing if computed position falls outside the viewport (safety)
      if (px < 0 || px > w || py < 0 || py > h) continue;

      // Size and color from point primitive if available
      let size = 4;
      let colorCss = 'rgba(255,255,255,0.9)';
      const v = sat.visualizer;
      if (v && v.point2) {
        if (typeof v.point2.pixelSize === 'number') size = v.point2.pixelSize;
        const col = v.point2.color && (v.point2.color._value || v.point2.color);
        if (col && typeof col.toCssColorString === 'function') {
          colorCss = col.toCssColorString();
        }
      }

      ctx.beginPath();
      ctx.arc(px, py, size * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = colorCss;
      ctx.fill();

      // Draw overlay label:
      // In What's Up mode, if global labels are ON, show every satellite name regardless of distance
      // even if no 3D label primitive (label2) exists.
      const globalShowAll = viewer.labelsOn;
      if ((globalShowAll && viewer.cameraMode === 'up') || (v && v.label2 && v.label2.show)) {
        let labelText = sat?.name;
        try {
          if (v && v.label2 && v.label2.text) {
            const t = v.label2.text;
            if (typeof t === 'string') {
              labelText = t;
            } else if (t && typeof t.getValue === 'function') {
              labelText = t.getValue(time);
            }
          }
        } catch (e) { /* ignore */ }
        if (labelText) {
          ctx.save();
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          const lx = px + Math.max(10, size * 0.75);
          const ly = py - Math.max(8, size * 0.5);
          // halo for readability
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(0,0,0,0.6)';
          ctx.strokeText(labelText, lx, ly);
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.fillText(labelText, lx, ly);
          ctx.restore();
        }
      }

      // Satellite az/el debug labels removed per design; elevation bands are labeled on the grid instead.

      // Only add hits if visible
      if (px >= 0 && px <= w && py >= 0 && py <= h) {
        viewer._upOverlayHits.push({ sat, entity: v, x: px, y: py, r: size * 0.5 });
      }
      if (viewer.selectedEntity && v === viewer.selectedEntity) {
        selPx = px; selPy = py; selR = Math.max(size * 0.5, 6);
      }
    }

    // Draw selection crosshair on overlay using same mapping, if any selection exists
    if (defined(viewer.selectedEntity) && selPx !== undefined) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.25;
      // Concentric rings
      ctx.beginPath();
      ctx.arc(selPx, selPy, selR + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(selPx, selPy, selR + 8, 0, Math.PI * 2);
      ctx.stroke();
      // Crosshair ticks
      const tick = 6;
      ctx.beginPath();
      ctx.moveTo(selPx - (selR + 12), selPy);
      ctx.lineTo(selPx - (selR + 4), selPy);
      ctx.moveTo(selPx + (selR + 4), selPy);
      ctx.lineTo(selPx + (selR + 12), selPy);
      ctx.moveTo(selPx, selPy - (selR + 12));
      ctx.lineTo(selPx, selPy - (selR + 4));
      ctx.moveTo(selPx, selPy + (selR + 4));
      ctx.lineTo(selPx, selPy + (selR + 12));
      ctx.stroke();
      ctx.restore();
    }
  }

  // Draw overlay after scene render (and after post-process), so it's not warped
  scene.postRender.addEventListener(function (scene, time) {
    drawUpOverlay(time);
  });

  // Fresh hit-test at event time to improve picking reliability
  function pickUpOverlayAt(clientX, clientY) {
    if (viewer.cameraMode !== 'up') return undefined;
    const rect = viewer._element.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const aspect = w / Math.max(1, h);
    const radiusPx = 0.5 * Math.min(w, h);

    const thetaMax = viewer.camera.frustum.fov * 0.5;

    const f = viewer.camera.directionWC;
    const u = viewer.camera.upWC;
    const r = viewer.camera.rightWC;
    const cpos = viewer.camera.positionWC;

    let best = undefined;
    let bestD2 = Infinity;
    const sats = universe._trackables || [];
    const time = viewer.clock.currentTime;
    for (let i = 0; i < sats.length; i++) {
      const sat = sats[i];
      const spos = getObjectPositionInCesiumFrame(viewer, universe, sat, time);
      const vx = spos.x - cpos.x;
      const vy = spos.y - cpos.y;
      const vz = spos.z - cpos.z;
      const len = Math.hypot(vx, vy, vz);
      if (len === 0) continue;
      const nx = vx / len, ny = vy / len, nz = vz / len;
      const dirx = nx * r.x + ny * r.y + nz * r.z;
      const diry = nx * u.x + ny * u.y + nz * u.z;
      const dirz = nx * f.x + ny * f.y + nz * f.z;
      if (dirz <= 0.0) continue;
      const theta = Math.acos(Math.min(1.0, Math.max(-1.0, dirz)));
      if (theta > thetaMax) continue;
      // Same equidistant mapping as draw: r = theta/thetaMax (no 2D fudge)
      let rLin = Math.min(1.0, Math.max(0.0, theta / thetaMax));
      const alpha = Math.atan2(dirx, diry);
      const px = cx + radiusPx * rLin * Math.sin(alpha);
      const py = cy - radiusPx * rLin * Math.cos(alpha);

      // Skip off-screen candidates for robustness
      if (px < 0 || px > w || py < 0 || py > h) continue;

      let size = 4;
      let entity = sat.visualizer;
      if (entity && entity.point2) {
        if (typeof entity.point2.pixelSize === 'number') size = entity.point2.pixelSize;
      }
      const pickR = Math.max(size * 0.5, 6);
      const dx = x - px;
      const dy = y - py;
      const d2 = dx * dx + dy * dy;
      if (d2 <= pickR * pickR && d2 < bestD2) {
        bestD2 = d2;
        best = { sat, entity };
      }
    }
    return best;
  }

  // Draw annotations for What's Up overlay: cardinal ticks, elevation rings/labels, and azimuth spokes
  function drawUpGrid(ctx, cx, cy, radiusPx, fov) {
    ctx.save();
    ctx.lineWidth = 1;

    const thetaMax = 0.5 * fov; // max zenith angle shown
    const elEdge = Math.max(0, 90 - thetaMax * CMath.DEGREES_PER_RADIAN);

    // Elevation rings and labels within FOV (edge is elEdge)
    const rings = [80, 70, 60, 50, 40, 30, 20, 10];
    rings.filter((el) => el >= elEdge - 1e-3).forEach((el) => {
      const thetaDeg = 90 - el;
      // equidistant radius (no 2D fudge)
      let rNorm = Math.min(1, (thetaDeg * CMath.RADIANS_PER_DEGREE) / thetaMax);
      const r = rNorm * radiusPx;
      // Ring
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      // Label (white)
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const label = el === 0 ? `el ${el}\u00B0 (horizon)` : `el ${el}\u00B0`;
      ctx.fillText(label, cx + 6, cy - r);
    });

    // Azimuth spokes every 10° (light), heavier every 30°, with cardinal letters
    for (let azDeg = 0; azDeg < 360; azDeg += 10) {
      const a = azDeg * CMath.RADIANS_PER_DEGREE;
      const x = cx + radiusPx * Math.sin(a);
      const y = cy - radiusPx * Math.cos(a);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineWidth = (azDeg % 30 === 0) ? 1.25 : 0.75;
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    // Cardinal directions: N (0°), E (90°), S (180°), W (270°)
    const cardinals = [
      { name: 'N', azDeg: 0 },
      { name: 'E', azDeg: 90 },
      { name: 'S', azDeg: 180 },
      { name: 'W', azDeg: 270 },
    ];
    cardinals.forEach((c) => {
      // Neutral color for cardinal rays and labels
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      const a = c.azDeg * CMath.RADIANS_PER_DEGREE;
      const x = cx + radiusPx * Math.sin(a);
      const y = cy - radiusPx * Math.cos(a);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineWidth = 1.5;
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lx = cx + (radiusPx + 12) * Math.sin(a);
      const ly = cy - (radiusPx + 12) * Math.cos(a);
      ctx.fillText(c.name, lx, ly);
    });

    // Azimuth numerals every 30°, skip cardinals (0/90/180/270) to reduce clutter
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let azDeg = 0; azDeg < 360; azDeg += 30) {
      if (azDeg % 90 === 0) continue; // skip where cardinal letters are shown
      const a = azDeg * CMath.RADIANS_PER_DEGREE;
      const lx = cx + (radiusPx + 22) * Math.sin(a);
      const ly = cy - (radiusPx + 22) * Math.cos(a);
      ctx.fillText(`${azDeg}\u00B0`, lx, ly);
    }

    ctx.restore();
  }

  return viewer;
}


export {
  createViewer,
  mixinViewer
}
