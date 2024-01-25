import { JulianDate, PointPrimitiveCollection, BillboardCollection, LabelCollection, Viewer, ImageryLayer, UrlTemplateImageryProvider, IonImageryProvider, defined, Math as CMath, Cartesian2, Cartesian3, Matrix4, Color, SceneMode, ReferenceFrame, defaultValue, PostProcessStage, EntityView, Entity, Clock } from "cesium"
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

  options = defaultValue(options, {})
  if (!defined(options.infoBox))
    options.infoBox = false

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
  options = defaultValue(options, {})
  options.showNightLayer = defaultValue(options.showNightLayer, true)
  options.showWeatherLayer = defaultValue(options.showWeatherLayer, true)
  options.weatherApiKey = defaultValue(options.weatherApiKey, 'YOUR_API_KEY')
  options.infoBox2 = defaultValue(options.infoBox2, true)
  options.infoBox2Container = defaultValue(viewer._element, undefined)
  options.toolbar2 = defaultValue(options.toolbar2, true)
  options.toolbar2Container = defaultValue(viewer._element, undefined)

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
   * Add an updatePost listener to fix point primitive tracking.
   * @param {Clock} clock 
   */
  const updatePost = function (clock) {
    if (defined(viewer._entityView && defined(viewer._trackedEntity)) && defined(viewer._trackedEntity.point2) ) { // fix for point primitive not tracking
      viewer._entityView.update(clock.currentTime, viewer.boundingSphereScratch)
    }
  }
  viewer._eventHelper.add(viewer.clock.onTick, updatePost, viewer);

  /**
   * Override the scene pick function.
   * @param {Cartesian2} windowPosition - The window position.
   * @param {number} [width] - Seems to always be undefined.
   * @param {number} [height] - Seems to always be undefined.
   * @returns {Entity} - The picked entity.
   */
  scene.pick = function (windowPosition, width, height) {

    if(viewer.cameraMode === "up") {
      //note: don't override width and height, makes drillPick super slow
      const bwidth = scene.context.drawingBufferWidth / viewer.resolutionScale;
      const bheight = scene.context.drawingBufferHeight / viewer.resolutionScale;
      const aspectRatio = bwidth / bheight;
      let uv = new Cartesian2(windowPosition.x / bwidth * 2.0 - 1.0, windowPosition.y / bheight * 2.0 - 1.0);

      if (aspectRatio > 1.0) { 
        uv.x *= aspectRatio;
      } else {
        uv.y /= aspectRatio;
      }  

      if(Cartesian2.magnitude(uv) >= 1.0) { //don't pick outside the sphere
        return undefined
      }

      let z = Math.sqrt(1.0 - uv.x * uv.x - uv.y * uv.y); // sphere eq: r^2 = x^2 + y^2 + z^2
      let k = 1.0 / (z * Math.tan(camera.frustum.fov * 0.5));
      uv.x = (uv.x * k) + 0.5;
      uv.y = (uv.y * k) + 0.5;
      windowPosition = new Cartesian2(bwidth * uv.x, bheight * uv.y)
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

  /**
   * Post update listener which adds new 3D perspectives and ECI mode.
   */
  scene.postUpdate.addEventListener((scene, time) => {
    const camera = viewer.camera
    ecrButton.checked = viewer.referenceFrameView === ReferenceFrame.FIXED
    universe.earth.update(time, universe)
    viewer._selectionIndicator = selectionIndicator

    // senor perspective
    if (viewer.cameraMode === "sensor") {
      viewer.trackedSensor.update(time, universe)
      camera.direction = new Cartesian3(0, 0, -1);
      camera.right = new Cartesian3(1, 0, 0);
      camera.up = new Cartesian3(0, 1, 0);
      camera.position = new Cartesian3(CMath.EPSILON19, 0, 0) // if 0,0,0, cesium will crash

      universe.earth.update(time, universe)
      const transform = new Matrix4()
      Matrix4.multiply(universe.earth.worldToLocalTransform, viewer.trackedSensor.localToWorldTransform, transform)
      Matrix4.clone(transform, camera.transform);
      camera.frustum.fov = CMath.toRadians(viewer.trackedSensor.x_fov + viewer.trackedSensor.x_fov * 0.2)
    // sensor what's up
    } else if (viewer.cameraMode === "up") {
      viewer._selectionIndicator = undefined //doesn't work in this mode
      viewer.trackedSensor.update(time, universe)
      camera.direction = new Cartesian3(0, 0, 1);
      camera.right = new Cartesian3(0, 1, 0);
      camera.up = new Cartesian3(-1, 0, 0);
      camera.position = new Cartesian3(CMath.EPSILON19, 0, 0) // if 0,0,0, cesium will crash

      universe.earth.update(time, universe)
      const transform = new Matrix4()
      Matrix4.multiply(universe.earth.worldToLocalTransform, viewer.trackedSensor.parent.parent.localToWorldTransform, transform)
      Matrix4.clone(transform, camera.transform);
      camera.frustum.fov = CMath.toRadians(160)
    // world view
    } else {
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
  })

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
    if(Math.abs(JulianDate.secondsDifference(lastUniverseUpdate, time)) != 0) {
      JulianDate.clone(time, lastUniverseUpdate);
      dirty = true;
    }
  
    if(picked !== lastPickedUpdate) {
      lastPickedUpdate = picked;
      dirty = true;
    }
  
    return dirty;
  }
  
  /**
   * Pre update listener which updates the universe.
   */
  viewer.scene.preUpdate.addEventListener((scene, time) => {
  
    if(!isDirty(time, viewer.pickedObject)) {
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

    // Grid for what's up view
    viewer.sensorGrids.push(viewer.entities.add({
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
    }))
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
    if(defined(point)) {
      entity.point2 = viewer.points.add(point)
      entity.point2.id = entity  // required for picking
      entity.update = function(time, universe) {
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

    viewer.sensorGrids.forEach(function (v) {
      v.show = mode === "up";
    });

    viewer.sensorForVisualizers.forEach(function (v) {
      v.outline = mode === "world";
    });

    viewer.sensorFovVisualizers.forEach(function (v) {
      v.outline = mode === "world";
    });

    viewer.cameraMode = mode;   
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

          // create new point primitive
          if(!defined(obj.visualizer.label2)) {
            obj.visualizer.label2 = viewer.labels.add({
              text: obj.name,
              font: '14px sans-serif',
            })
            obj.visualizer.label2.id = entity  // required for picking
            obj.visualizer.label2.update = function(time, universe) {
              obj.visualizer.label2.position = getObjectPositionInCesiumFrame(viewer, universe, obj, time)
            }
            obj.updateListeners.push(entity.label2);
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




  ///////////////////
  // UI Widgets
  ///////////////////

  // Improved Infobox
  if (options.infoBox2) {
    const infoBoxContainer = document.createElement("div");
    infoBoxContainer.className = "cesium-viewer-infoBoxContainer";
    options.infoBox2Container.appendChild(infoBoxContainer);
    const infoBox = new InfoBox(infoBoxContainer, viewer, universe);

    function trackCallback(infoBoxViewModel) {
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
    }

    function closeInfoBox(infoBoxViewModel) {
      viewer.selectedEntity = undefined;
    };

    const infoBoxViewModel = infoBox.viewModel;
    viewer._eventHelper.add(
      infoBoxViewModel.cameraClicked,
      trackCallback,
      this
    );
    viewer._eventHelper.add(
      infoBoxViewModel.closeClicked,
      closeInfoBox,
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
    camera.frustum = camera.frustum;
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

  // Add post process stage to fix wide fov distortion
  const fs = `
uniform sampler2D colorTexture;
uniform float fov;
uniform int mode;
uniform float aspectRatio;
in vec2 v_textureCoordinates; // input coord is 0 to +1
//const float fovTheta = 160.0 * 3.1415926535 / 180.0; // FOV's theta
const float PI = 3.1415926535;

void main (void)
{   
    if (mode == 1) {
      out_FragColor = texture(colorTexture, v_textureCoordinates);
      return;
    }

    vec2 uv = 2.0 * v_textureCoordinates - 1.0; // between -1 and +1
    vec2 fov2 = vec2(fov, fov);
    if (aspectRatio > 1.0) { 
      uv.x *= aspectRatio;
      // fov2.y /= aspectRatio;
    } else {
      uv.y /= aspectRatio;
      // fov2.x *= aspectRatio;
    }
    float d = length(uv);

    if (d < 0.95) {    
      float z = sqrt(1.0 - uv.x * uv.x - uv.y * uv.y); // sphere eq: r^2 = x^2 + y^2 + z^2
      float kx = 1.0 / (z * tan(fov2.x * 0.5));
      float ky = 1.0 / (z * tan(fov2.y * 0.5));
      vec4 c = texture(colorTexture, vec2(uv.x * kx, uv.y * ky) + 0.5); // between 0 and +1
      out_FragColor = c;
    } else {
      uv = v_textureCoordinates;
      vec4 c = texture(colorTexture, uv);
      out_FragColor = vec4(c.rgb * 0.0, 1.0);
    }
  }
`;

  scene.postProcessStages.add(new PostProcessStage({
    fragmentShader : fs,
    uniforms : {
        fov : function() {
          return defined(camera.frustum.fov) ? camera.frustum.fov : 0.0;
        },
        mode : function() {
          return viewer.cameraMode === "up" ? 0 : 1;
        },
        aspectRatio : function() {
          return camera.frustum.aspectRatio;
        }
    }
  }));

  return viewer;
};


export {
  createViewer,
  mixinViewer
}
