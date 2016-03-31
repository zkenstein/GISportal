/**
 * gisportal.js
 * This file is the main portion of the codebase,
 * it is the namespace. It is called by portal.js
 * and is responsible for all of the other files.
 */


/**
 * Create namespace object
 * @namespace gisportal
 */ 
var gisportal = gisportal || (gisportal = {});

gisportal.VERSION = "0.4.0";
// This used to get the specific revision number from SVN. Need to change for Git
//gisportal.SVN_VERSION = "$Rev$".replace(/[^\d.]/g, ""); // Return only version number

/*==========================================================================*/
//Initialise javascript variables and objects

if( ! window.location.origin )
   window.location.origin = window.location.protocol + "//" + window.location.host;

// The domain name of the portal
gisportal.domainName = window.location.origin + window.location.pathname;

// This edits the domain name a bit to be sent to the middleware (removes the end "/" and replaces all other "/"s with "_")
gisportal.niceDomainName = gisportal.domainName.replace("http://", "").replace("https://", "").replace(/\/$/, '').replace(/\//g, '_');

// Path to the middleware
gisportal.middlewarePath = gisportal.domainName.replace(/\/$/, '') + "/app";

// Flask url paths, relates to /middleware/portalflask/views/
gisportal.stateLocation = gisportal.middlewarePath + '/state';

// Define a proxy for the map to allow async javascript http protocol requests
gisportal.ProxyHost = gisportal.middlewarePath + '/settings/proxy?url=';

// Stores the data provided by the master cache file on the server. This 
// includes layer names, titles, abstracts, etc.
gisportal.cache = {};
gisportal.cache.wmsLayers = [];

// gisportal.layers has all of the actual layer details
gisportal.layers = {};

// gisportal.selectedLayers is an array of the ids of your selected layers
// to get the layer use gisportal.layers[gisportal.selectedLayers[i]]
gisportal.selectedLayers = [];

// Base layers are the map layers that show under the data
gisportal.baseLayers = {};

// Array of ALL available date-times for all date-time layers where data's available
// The array is populated once all the date-time layers have loaded
gisportal.enabledDays = [];

// Used as offsets when sorting layers in groups
gisportal.numBaseLayers = 0;
gisportal.numOpLayers = 0;

// Stores the current user selection. Any changes should trigger the correct event.
// Could be changed to an array later to support multiple user selections
gisportal.selection = {};
gisportal.selection.layer = undefined;
gisportal.selection.bbox = undefined;
gisportal.selection.time = undefined;

// gisportal.graphs is used as the object for graphing.js
gisportal.graphs = {};

// gisportal.selectionTools is used as the object for selection.js
gisportal.selectionTools = null;

// gisportal.timeline is used as the object for timeline.js
gisportal.timeline = null;

// Predefined map coordinate systems
gisportal.availableProjections = {
   'EPSG:4326': { 
      code: 'EPSG:4326',
      name: 'WGS 84',
      bounds: [-180, -90, 180, 90]
   },
   'EPSG:3857': { 
      code: 'EPSG:3857',
      name: 'WGS 84 / Pseudo-Mercator',
      bounds: [-20037508.342789244, -19971868.880408563, 20037508.342789244, 19971868.88040853]    // -180, -85, 180, 85
   }
};

gisportal.projection = gisportal.availableProjections['EPSG:4326'].code;


/**
 * The OpenLayers map object
 * Soon to be attached to gisportal namespace
 */
var map;

/*===========================================================================*/

/**
 * Map function to get the master cache JSON files from the server and then 
 * start layer dependent code asynchronously
 */
gisportal.loadLayers = function() { 
   // The old layers will be removed from the portal keeping any layers that are already loaded to one side.
   gisportal.tempRemoveLayers();
   gisportal.original_layers = {};
   gisportal.not_included_layers = {};
   gisportal.layers = {};
   gisportal.loadVectorLayers();
   loadWmsLayers();
   
   function loadWmsLayers(){
      // Get WMS cache
      $.ajax({
         url:  gisportal.middlewarePath + '/settings/get_cache',
         dataType: 'json',
         success: gisportal.initWMSlayers,
         error: function(e){
            $.notify("Sorry\nThere was an unexpected error getting the cache. Try refreshing the page, or coming back later.", {autoHide:false, className:"error"});
         }
      });
   }

};

gisportal.tempRemoveLayers = function(){
   var id, layer, style;
   for(id in gisportal.selectedLayers){
      layer = gisportal.selectedLayers[id];
      style = gisportal.layers[layer].style;
      gisportal.tempSelectedLayers.push({id:layer, style:style});
   }
   for(id in gisportal.tempSelectedLayers){
      layer = gisportal.tempSelectedLayers[id].id;
      gisportal.indicatorsPanel.removeIndicators(layer);
   }
};

/**
 * Map function to load the vector layers from cache
 */
gisportal.loadVectorLayers = function() {


   $.ajax({
      url: gisportal.middlewarePath + '/cache/' + gisportal.niceDomainName +'/vectorLayers.json',
      dataType: 'json',
      success: gisportal.initVectorLayers,
      error: function(e){
            console.log("No Vector Layers Found");
         }

   });

};


gisportal.createVectorLayers = function() {
   gisportal.vlayers = [];
   gisportal.vectors = [];
   gisportal.cache.vectorLayers.forEach(function( vector ){
      //console.log(vector);
      vector.services.wfs.vectors.forEach(function( v ){
      processVectorLayer(vector.services.wfs.url, v);

      });
   });

   function processVectorLayer(serverUrl, vector) {
      var vectorOptions = {
         "name": vector.name,
         "description": vector.desc,
         "endpoint" : serverUrl,
         "serviceType" : "WFS",
         "variableName" : vector.variableName,
         "maxFeatures" : vector.maxFeatures,
         "tags" : vector.tags,
         "id" : vector.id,
         "exBoundingBox" : vector.exBoundingBox,
         "metadataQueue" : [],
         "abstract" : vector.abstract,
         "provider" : vector.provider,
         "contactInfo" : {
            "organization" : vector.provider
         },
         "ignoredParams" : vector.ignoredParams,
         "vectorType" : vector.vectorType,
         "styles" : vector.styles,
         "defaultProperty" : vector.defaultProperty,
         "defaultProperties" : vector.defaultProperties,
         "descriptiveName" : vector.tags.niceName,
         "unit" : vector.unit,
         "moreIndicatorInfo" : vector.moreIndicatorInfo
      };
      //console.log("  CREATING WITH VECTOR FUNCTION   ");
      var vectorLayer = new gisportal.Vector(vectorOptions);
      gisportal.vectors.push(vectorLayer);

gisportal.layers[vectorOptions.id] = vectorLayer;

      //console.log(vectorLayer);
      vectorLayerOL = vectorLayer.createOLLayer();
      //vectorLayer.openlayers.anID = vectorLayerOL;
      //console.log(vectorLayerOL);
      gisportal.vlayers.push(vectorLayerOL);
   }

};

/** 
 * Create layers from the getCapabilities request (stored in gisportal.cache.wmsLayers)
 * iterates over each and adds to gisportal.layers 
 */
gisportal.createOpLayers = function() {
   var layers = [];

   // Loop over each server
   gisportal.cache.wmsLayers.forEach(function( server ){
      processServer( server );
   });

   function processIndicatorLoop(sensorName, server){
      server.server[sensorName].forEach(function( indicator ){
         processIndicator( server, sensorName, indicator );
      });
   }

   // Processing the indicators at each indicator
   function processServer( server ){
      for(var sensorName in server.server ){
         processIndicatorLoop(sensorName, server);
      }
   }

   // Turn an indicator into a later and adding to gisportal.layers
   function processIndicator( server, sensorName, indicator ){

      var wcs_url = indicator.wcsURL || server.wcsURL;

      var include_bool = true;

      if(indicator.include === false){
         include_bool = false;
      }

      var layerOptions = { 
         //new
         "abstract": indicator.Abstract,
         "include": include_bool,
         "contactInfo": server.contactInfo,
         "timeStamp":server.timeStamp,
         "owner":server.owner,
         "name": indicator.Name,
         "title": indicator.Title,
         "productAbstract": indicator.productAbstract,
         "legendSettings": indicator.LegendSettings,
         "type": "opLayers",

         //orginal
         "firstDate": indicator.FirstDate, 
         "lastDate": indicator.LastDate, 
         "serverName": server.serverName, 
         "wmsURL": server.wmsURL, 
         "wcsURL": wcs_url, 
         "sensor": sensorName, 
         "exBoundingBox": indicator.EX_GeographicBoundingBox, 
         "providerTag": server.options.providerShortTag,
         "positive" : server.options.positive, 
         "provider" : indicator.providerDetails, 
         "offsetVectors" : indicator.OffsetVectors, 
         "tags": indicator.tags,
         "moreProviderInfo" : indicator.MoreProviderInfo,
         "moreIndicatorInfo" : indicator.MoreIndicatorInfo,
      };

      var layer = new gisportal.layer( layerOptions );
//console.log("adding info for Indicator : ");
            //console.log(layer);
      // If theres a duplicate id, increase a counter
      var postfix = "";
      while( gisportal.layers[layer.id + postfix ] !== void(0) )
         postfix++; // will convert the "" into a number

      layer.id = layer.id + postfix;
      if(layer.include){
         gisportal.layers[layer.id] = layer;
      }else{
         gisportal.not_included_layers[layer.id] = layer;
      }

   }

   // This block restores the old selected layers so that the layers.openlayers object exists
   // It is done in revers order so that they stay in the same order as when they were taken off
   var id, i;
   for(i = _.size(gisportal.tempSelectedLayers)-1; i >= 0; i--){
      id = gisportal.tempSelectedLayers[i].id;
      style = gisportal.tempSelectedLayers[i].style;
      try{
         gisportal.layers[id].mergeNewParams({STYLES:style});
         gisportal.refinePanel.layerFound(id, style);
      }catch(e){
         console.log("Cannot add that layer!");
      }
   }
   gisportal.tempSelectedLayers = [];

   // This block restores the old selected layers using the new IDs that have just been set
   for(i in gisportal.addLayersForm.selectedLayers){
      id = gisportal.addLayersForm.selectedLayers[i];
      try{
         gisportal.refinePanel.layerFound(id);
      }catch(e){
         console.log("Cannot add that layer!");
      }
   }
   gisportal.addLayersForm.selectedLayers = [];

   var state = gisportal.cache.state;
   gisportal.layersLoaded = true;
   if (!gisportal.stateLoadStarted && state) gisportal.loadState(state);

   if(_.size(gisportal.layers) <= 0){
      if(_.size($('.notifyjs-gisportal-info span:contains("There are currently no layers in the portal")')) <= 0){
         $.notify("There are currently no layers in the portal \n Please load some up using the highlighted section to the left", {autoHide:false});
         gisportal.panels.showPanel('map-settings');
         $('.js-category-filter').html("");
         $('form.add-wms-form .js-wms-url').toggleClass("alert-warning", true);
      }
   }else{
      $('.notifyjs-gisportal-info span:contains("There are currently no layers in the portal")').closest('.notifyjs-wrapper').remove();
      $('form.add-wms-form .js-wms-url').toggleClass("alert-warning", false);
      gisportal.configurePanel.refreshData();
   }

   gisportal.events.trigger('layers-loaded');
};

/**
 * Get a layer that has been added to the map by its id.
 * This is the same as gisportal.layers[id], it is rarely used.
 * @param {string} id - The id of the layer
 */
gisportal.getLayerByID = function(id) {
   return gisportal.layers[id];
};

/**
 * Checks if a layer is selected
 * @param {string} id - id of layer to check
 */
gisportal.isSelected = function(id) {
   if (gisportal.selectedLayers[id]) return true;
};

/**
 * Checks if a layer ID is unique recursively
 * 
 * @param {gisportal.layer} layer - The layer to check 
 * @param {number} count - Number of other layers with the same name (optional)
 */
gisportal.checkNameUnique = function(layer, count) {
   var id = null;
   
   if (typeof count === "undefined" || count === 0) {
      id = layer.id;
      count = 0;
   } 
   else {
      id = layer.id + count;
   }
   
   if (id in gisportal.layers && layer.wcsURL !== gisportal.layers[layer.id].wcsURL) {
      gisportal.checkNameUnique(layer, ++count);
   } else {
      if (count !== 0) { 
         layer.id = layer.id + count; 
      }
   }
   return layer;
};

/**
 * Returns availability (boolean) of data for the given JavaScript date for all layers.
 * Used as the beforeshowday callback function for the jQuery UI current view date DatePicker control
 * 
 * @param {Date} thedate - The date provided by the jQuery UI DatePicker control as a JavaScript Date object
 * @return {Array.<boolean>} Returns true or false depending on if there is layer data available for the given date
 */
gisportal.allowedDays = function(thedate) {
   var uidate = gisportal.utils.ISODateString(thedate);
   // Filter the datetime array to see if it matches the date using jQuery grep utility
   var filtArray = $.grep(gisportal.enabledDays, function(dt, i) {
      var datePart = dt.substring(0, 10);
      return (datePart == uidate);
   });
   // If the filtered array has members it has matched this day one or more times
   if(filtArray.length > 0) {
      return [true];
   }
   else {
      return [false];
   }
};

/**
 * Map function to re-generate the global date cache for selected layers.
 */
gisportal.refreshDateCache = function() {
   var map = this;
   gisportal.enabledDays = [];
   
   $.each(map.layers, function(index, value) {
      var layer = value;
      if(layer.selected && layer.temporal) {
         gisportal.enabledDays = gisportal.enabledDays.concat(layer.DTCache);
      }
   });
   
   gisportal.enabledDays = gisportal.utils.arrayDeDupe(gisportal.enabledDays);  
   
   //console.info('Global date cache now has ' + gisportal.enabledDays.length + ' members.'); // DEBUG
};

/**
 * Sets up the map, plus its controls, layers, styling and events.
 */
gisportal.mapInit = function() {
   // these need to be declared using 'old school' getElementById or functions within the ol3 js don't work properly
   var dataReadingPopupDiv = document.getElementById('data-reading-popup');
   var dataReadingPopupContent = document.getElementById('data-reading-popup-content');
   var dataReadingPopupCloser = document.getElementById('data-reading-popup-closer');

   var dataReadingPopupOverlay = new ol.Overlay(/** @type {olx.OverlayOptions} */ ({
     element: dataReadingPopupDiv,
     autoPan: true,
     autoPanAnimation: {
       duration: 250
     }
   }));

   dataReadingPopupCloser.onclick = function() {
      dataReadingPopupOverlay.setPosition(undefined);
      dataReadingPopupCloser.blur();
      _.each(gisportal.selectedFeatures, function(feature){
         feature[0].setStyle(feature[1]);
      });
      gisportal.selectedFeatures = [];
      return false;
   };

   map = new ol.Map({
      target: 'map',
      controls: [
         new ol.control.FullScreen({
            label: $('<span class="icon-arrow-move-1"><span>').appendTo('body')
         }),
         new ol.control.Zoom({
            zoomInLabel: $('<span class="icon-zoom-in"></span>').appendTo('body'),
            zoomOutLabel: $('<span class="icon-zoom-out"></span>').appendTo('body')
         }),
         new ol.control.Attribution({
            collapsible: false,
            collapsed: false,
         }),
         new ol.control.ScaleLine({})
      ],
      overlays: [dataReadingPopupOverlay],
      view: new ol.View({
         projection: gisportal.projection,
         center: [0, 0],
         minZoom: 3,
         maxZoom: 17,
         resolution: 0.175,
      }),
      logo: false
   });
   gisportal.dragAndDropInteraction = new ol.interaction.DragAndDrop({
      formatConstructors: [
         ol.format.GPX,
         ol.format.GeoJSON,
         ol.format.IGC,
         ol.format.KML,
         ol.format.TopoJSON
      ]
   });

   // map.addInteraction(new ol.interaction.Select({
   //    condition: function(e) {
   //       return e.originalEvent.type=='mousemove';
   //    },
   //    hover : false
   // }));
   // cahnging fature overlay for ol3
   
   var collection = new ol.Collection();


   gisportal.featureOverlay = new ol.layer.Vector({
      map : map,
      source: new ol.source.Vector({
         features: collection,
         useSpatialIndex : false
      }),
      style : new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: [255,0,0,0.6],
          width: 2
        }),
        fill: new ol.style.Fill({
          color: [255,0,0,0.2]
        }),
        zIndex: 100000000
      }),
      updateWhileAnimating : true,
      updateWhileIneracting: true
   });

   // map.addInteraction(new ol.interaction.Select({
   //    condition : ol.events.condition.pointerMove
   // }))
   
   map.on('pointermove', function(evt) {
      
       var pixel = evt.pixel;
                gisportal.featureOverlay.getSource().clear();

      map.forEachFeatureAtPixel(pixel, function(feature, layer) {
         if(!layer){
            return;
         }
         //layer.getSource().removeFeature(feature);
         gisportal.featureOverlay.getSource().addFeature(feature);
      });

   });

   map.addInteraction(gisportal.dragAndDropInteraction);

   gisportal.dragAndDropInteraction.on('addfeatures', function(event) {
      // Make sure only one feature is loaded at a time
      gisportal.vectorLayer.getSource().clear();
      gisportal.vectorLayer.getSource().addFeatures(event.features);
      gisportal.currentSelectedRegion = gisportal.wkt.writeFeatures(event.features);
      cancelDraw();
      gisportal.methodThatSelectedCurrentRegion = {method:"dragAndDrop", justCoords:false};
      $('.js-coordinates').val("");
      $('input.js-upload-shape')[0].value = "";
      $('.users-geojson-files').val("default");
   });

   //add a click event to get the clicked point's data reading
    map.on('singleclick', function(e) {
        var isFeature = false;
        var response = '';
        if(gisportal.selectionTools.isSelecting){

         map.forEachFeatureAtPixel(e.pixel, function(feature,layer){
               var t_wkt = gisportal.wkt.writeFeatures([feature]);
               //TODO: Make the feature highlighted!!!
               gisportal.vectorLayer.getSource().clear();
               gisportal.currentSelectedRegion = t_wkt;
               $('.js-coordinates').val("");
               $('.js-upload-shape').val("");
               $('.users-geojson-files').val("default");
               gisportal.methodThatSelectedCurrentRegion = {method:"selectExistingPolygon", justCoords: false};
               cancelDraw();
               gisportal.selectionTools.isSelecting = false;
         });

        }
        else {
           map.forEachFeatureAtPixel(e.pixel,
               function(feature, layer) {
                   if (feature && _.keys(feature.getProperties()).length >1 ) {
                     var geom = feature.getGeometry();
                       _.each(gisportal.selectedFeatures, function(feature) {
                       });
                       var tlayer;
                       if(feature.getId()){
                         tlayer = gisportal.layers['rsg_' + feature.getId().split('.')[0]];
                       }
                       isFeature = true;
                       gisportal.selectedFeatures.push([feature, feature.getStyle()]);
                       var props = feature.getProperties();
                       for (var key in props) {
                           if (props.hasOwnProperty(key) && key != "geometry") {
                               if(tlayer){
                                  if ((!_.contains(tlayer.ignoredParams, key))&&(props[key]!==undefined)) {
                                      response += "<li>" + key + " : " + props[key] + "</li>";
                                  }
                               }else if(props[key]!==undefined){
                                 response += "<li>" + key + " : " + props[key] + "</li>";
                               }
                           }
                       }
                       response += "</ul>";
                       dataReadingPopupContent.innerHTML = response;
                       dataReadingPopupOverlay.setPosition(e.coordinate);
                   }
           });
           if (!isFeature && $('.drawInProgress').length <= 0) {
               var point = gisportal.reprojectPoint(e.coordinate, gisportal.projection, 'EPSG:4326');
               var lon = gisportal.normaliseLongitude(point[0], 'EPSG:4326').toFixed(3);
               var lat = point[1].toFixed(3);
               var elementId = 'dataValue' + String(e.coordinate[0]).replace('.', '') + String(e.coordinate[1]).replace('.', '');
               response = '<p>Measurement at:<br /><em>Longitude</em>: ' + lon + ', <em>Latitude</em>: ' + lat + '</p><ul id="' + elementId + '"><li class="loading">Loading...</li></ul>';
               dataReadingPopupContent.innerHTML = response;
               dataReadingPopupOverlay.setPosition(e.coordinate);

               gisportal.getPointReading(e);
           }
     }
    });

   map.on("moveend", function(data) {
      var centre = data.map.getView().getCenter();
      var zoom = data.map.getView().getZoom() || 3;      // 3 being the default zoom level, but ol3 doesn't explicitly return this if the zoom hasn't changed since first load
      gisportal.events.trigger('map.move', centre, zoom);
   });
 
   gisportal.loadLayers();

   // Create the base layers, country borders layers and graticules; set defaults
   gisportal.map_settings.init();         // map-settings.js
   
   // add vector layer for drawing area of interest polygons, and set up tools
   gisportal.selectionTools.init();

};

gisportal.selectedFeatures = [];


/**
 * The initiation of WMS layers, such as adding to gisportal.cache.
 * @param {object} data - The actual layer
 * @param {object} opts - Options, not currently used
 */ 
gisportal.initWMSlayers = function(data, opts) {

   if (data !== null)  {
      gisportal.cache.wmsLayers = data;
      // Create browse categories list
      gisportal.loadBrowseCategories(data);
      // Create WMS layers from the data
      gisportal.createOpLayers();
   }
};

/**
 * The initiation of Vector layers, such as adding to gisportal.cache.
 * @param {object} data - The actual layer
 * @param {object} opts - Options, not currently used
 */ 
gisportal.initVectorLayers = function(data, opts) {
   if (data !== null)  {

      gisportal.cache.vectorLayers = data;
      // Create WMS layers from the data
      gisportal.createVectorLayers();
   }
};



/*===========================================================================*/

/**
 * Loads anything that is not dependent on layer data.
 * This is used to set the layer index to be the correct order 
 */
gisportal.nonLayerDependent = function() {
   
   // Setup timeline, from timeline.js
   gisportal.timeline = new gisportal.TimeLine('timeline', {
      comment: "Sample timeline data",
      selectedDate: new Date("2015-06-05T00:00:00Z"),
      chartMargins: {
         top: 7,
         right: 0,
         bottom: 5,
         left: 0
      },
      barHeight: 10,
      barMargin: 2,
      timebars: [] 
   });
};

/*===========================================================================*/

gisportal.autoSaveState = function(){
   var state = JSON.stringify(gisportal.saveState());
   gisportal.storage.set( 'stateAutoSave', state );
};

gisportal.getAutoSaveState = function(){
   var state = JSON.parse(gisportal.storage.get( 'stateAutoSave' ));
   return state;
};
gisportal.hasAutoSaveState = function(){
   return ( gisportal.storage.get( 'stateAutoSave' ) !== null );
};

/**
 * Creates an object that contains the current state
 * @param {object} state - Optional, allows a previous state to be extended 
 */
gisportal.saveState = function(state) {
   state = state || {}; 
   // Save layers
   state.map = {};
   state.selectedRegionInfo = gisportal.methodThatSelectedCurrentRegion;
   state.selectedIndicators = [];
   state.map.layers = {}; 
   state.timeline = {};
   state.view = gisportal.current_view;

   // // Get the current layers and any settings/options for them.
   // var keys = gisportal.selectedLayers;
   // for(var i = 0, len = keys.length; i < len; i++) {
   //    var selectedIndicator = gisportal.selectedLayers[i];

   //    if (selectedIndicator)  {
   //       var indicator = gisportal.layers[selectedIndicator];
   //       state.map.layers[indicator.id] = {
   //          'selected': indicator.selected,
   //          'opacity': indicator.opacity !== null ? indicator.opacity : 1,
   //          'style': indicator.style !== null ? indicator.style : '',
   //          'minScaleVal': indicator.minScaleVal,
   //          'maxScaleVal': indicator.maxScaleVal,
   //          'openTab' : $('.indicator-header[data-id="' + indicator.id + '"] + ul .js-tab-trigger:checked').attr('id')
   //       };    
   //    }
   // }
   // outside of loop so it can be easily ordered 
   var layers = [];
   $('.sortable-list .indicator-header').each(function() {
      layers.unshift($(this).parent().data('id'));
   });
   state.selectedIndicators = layers;
   
   // Get currently selected date.
   if(!gisportal.utils.isNullorUndefined($('.js-current-date').val())) {
      state.map.date = gisportal.timeline.getDate();
   }
     
   // Get selection from the map
   var features = gisportal.vectorLayer.getSource().getFeatures();
   var geoJsonFormat = new ol.format.GeoJSON();
   var featureOptions = {
      'dataProjection': gisportal.projection,
      'featureProjection': gisportal.projection
   };
   state.map.feature = geoJsonFormat.writeFeatures(features, featureOptions);   
   
   // Get zoom level
   state.map.zoom = map.getView().getZoom();

   // Get position
   state.map.centre = map.getView().getCenter();

   // Get timeline zoom
   state.timeline.minDate = gisportal.timeline.xScale.domain()[0];
   state.timeline.maxDate = gisportal.timeline.xScale.domain()[1];

   state.map.baselayer = $('#select-basemap').data().ddslick.selectedData.value;
   state.map.countryborders = $('#select-country-borders').data().ddslick.selectedData.value;
   state.map.graticules = $('#select-graticules').data().ddslick.selectedData.value;

   return state;
};

/**
 * To load the state, provide a state object (created with saveState)
 * @param {object} state - The saved state object
 */
gisportal.loadState = function(state) {
   
   //console.log("Loading State!")
   gisportal.stateLoadStarted = true;
   $('.start').toggleClass('hidden', true);
   state = state || {};

   var stateTimeline = state.timeline;
   var stateMap = state.map;
   
   // Load layers for state
   var keys = state.selectedIndicators;
   var available_keys = [];

   for(var key in keys){
      if (gisportal.layers[keys[key]]){
         available_keys.push(keys[key]);
      }
   }
   if (available_keys.length > 0)  {
      gisportal.indicatorsPanel.open();
   }
   for (var i = 0, len = available_keys.length; i < len; i++) {
      var indicator = null;
      if (typeof available_keys[i] === "object") indicator = gisportal.layers[available_keys[i].id];
      else indicator = gisportal.layers[available_keys[i]];
      if (indicator && !gisportal.selectedLayers[indicator.id]) {
         if(indicator.serviceType == "WFS"){
            console.log("Please load the vector properly");
         }else{
            gisportal.configurePanel.close();
            // this stops the map from auto zooming to the max extent of all loaded layers
            indicator.preventAutoZoom = true;
            gisportal.refinePanel.layerFound(indicator.id);
            if(state.selectedRegionInfo){
               gisportal.methodThatSelectedCurrentRegion = state.selectedRegionInfo;
               switch( state.selectedRegionInfo.method ){
                  case "drawBBox":
                     gisportal.currentSelectedRegion = state.selectedRegionInfo.value;
                     break;
                  case "csvUpload":
                     gisportal.methodThatSelectedCurrentRegion = {};
                     break;
                  case "geoJSONSelect":
                     gisportal.indicatorsPanel.geoJSONSelected(state.selectedRegionInfo.value);
                     break;
                  case "dragAndDrop":
                     stateMap.feature = undefined;
                     break;
                  case "selectExistingPolygon":
                     gisportal.methodThatSelectedCurrentRegion = {};
                     break;
               }
            }
         }
      }
   }
   
   // Create the feature if there is one
   if (stateMap.feature) {    // Array.<ol.Feature>
      var geoJsonFormat = new ol.format.GeoJSON();
      var featureOptions = {
         'dataProjection': gisportal.projection,
         'featureProjection': gisportal.projection
      };
      var features = geoJsonFormat.readFeatures(stateMap.feature, featureOptions);
      gisportal.vectorLayer.getSource().addFeatures(features);
   }
   
   if (stateTimeline)  {
      gisportal.timeline.zoomDate(stateTimeline.minDate, stateTimeline.maxDate);
      if (stateMap.date) gisportal.timeline.setDate(new Date(stateMap.date));
   }

   if (stateMap.baselayer) {
      gisportal.selectBaseLayer(stateMap.baselayer);
      $('#select-basemap').val(stateMap.baselayer);
   }

   if (stateMap.countryborders) {
      gisportal.selectCountryBorderLayer(stateMap.countryborders);
      $('#select-country-borders').val(stateMap.countryborders);
   }

   if (stateMap.graticules) {
      $('#select-graticules').val(stateMap.graticules);
   }

   // Load position & zoom
   var view = map.getView();
   view.setZoom(stateMap.zoom);
   view.setCenter(stateMap.centre);
   if(state.view){
      gisportal.view.loadView(state.view.view_name);
   }

};

/**
 * This converts from Feature to GeoJSON
 * @param {object} feature - The feature
 */
gisportal.featureToGeoJSON = function(feature, from_proj, to_proj) {
   var geoJSON = new ol.format.GeoJSON();
   var featureOptions = {
      dataProjection: to_proj,
      featureProjection: from_proj
   };
   return geoJSON.writeFeature(feature, featureOptions);
};

/**
 * This converts from GeoJSON to Feature
 * @param {string} geoJSONFeature - The GeoJSON
 */
gisportal.geoJSONToFeature = function(geoJSONFeature) {
   var geoJSON = new ol.format.GeoJSON();
   return geoJSON.readFeature(geoJSONFeature); 
};

/**
 * This applies the changes from the state
 * to the layer once it is selected.
 * @param {object} layer - The gisportal.layer[i] 
 */
gisportal.checkIfLayerFromState = function(layer) {
   if(typeof gisportal.cache.state !== "undefined") {
      var keys = Object.keys(gisportal.cache.state.map.layers);
      var state = gisportal.cache.state.map;
      for(var i = 0, len = keys.length; i < len; i++) {
         if(keys[i] == layer.id){
            layer.setOpacity(state.layers[keys[i]].opacity);
            layer.setStyle(state.layers[keys[i]].style);
            layer.minScaleVal = state.layers[keys[i]].minScaleVal;
            layer.maxScaleVal = state.layers[keys[i]].maxScaleVal;
            gisportal.scalebars.updateScalebar(layer.id);
         }
      }
   }
};


/*===========================================================================*/

/**
 * Gets the current state of the portal from any and all components who have 
 * a state and wish to be stored. 
 */
gisportal.getState = function() {
   var state = {};
   
   // TODO: Split state into components
   state = gisportal.saveState(state);

   // TODO: Merge state with default state.
   
   // TODO: Return state.
   return state; 
};

/**
 * Loads the state and adds into cache
 * @param {object} state - The state object
 */
gisportal.setState = function(state) {
   state = state || {}; 
   // Cache state for access by others
   gisportal.cache.state = state;
   // TODO: Merge with default state. 
   if (!gisportal.stateLoadStarted && state && gisportal.layersLoaded) gisportal.loadState(state);
   
};

/*===========================================================================*/

/**
 * This code runs once the page has loaded - jQuery initialised.
 * It is called from portal.js
 */
gisportal.main = function() {

   if( gisportal.config.browserRestristion ){
      if( gisportal.validateBrowser() === false )
         return;
   }
      


   if( gisportal.config.siteMode == "production" ) {
      gisportal.startRemoteErrorLogging();
   } else {
      $('body').prepend('<div class="dev-warning">DEVELOPMENT MODE</div>');
      $('.js-start-container').addClass('start-dev');
   }

   // Compile Templates
   gisportal.loadTemplates(function(){
      
      gisportal.initStart();

      // Set up the map
      // any layer dependent code is called in a callback in mapInit
      gisportal.mapInit();

      $('#version').html('v' + gisportal.VERSION + ':' + gisportal.SVN_VERSION);

      // Initiate the DOM for panels
      gisportal.panels.initDOM();
      gisportal.indicatorsPanel.initDOM();  // indicators.js
      gisportal.graphs.initDOM();           // graphing.js
      gisportal.analytics.initGA();         // analytics.js
      gisportal.panelSlideout.initDOM();    //panel-slideout.js
      gisportal.user.initDOM();      // panels.js
      
      //Set the global loading icon
      gisportal.loading.loadingElement= jQuery('.global-loading-icon');
      
      $('.js-show-tools').on('click', showPanel);

      function showPanel()  {
         $('.js-show-tools').toggleClass('hidden', true);
         $('.panel.active').toggleClass('hidden', false);
      }

      $('.js-hide-panel').on('click', hidePanel);

      function hidePanel()  {
         $('.panel.active').toggleClass('hidden', true);
         $('.js-show-tools').toggleClass('hidden', false);
      }

      // Start setting up anything that is not layer dependent
      gisportal.nonLayerDependent();

      // Grab the url of any state and store it as an id to be used
      // for retrieving a state object.
      var stateID = gisportal.utils.getURLParameter('state');
      if(stateID !== null) {
         //console.log('Retrieving State...');
         gisportal.ajaxState(stateID);
      }
      else {
         //console.log('Loading Default State...');
      }

      collaboration.initDOM();
      // Replaces all .icon-svg with actual SVG elements,
      // so that they can be styled with CSS
      // which cannot be done with SVG in background-image
      // or <img>
      
   });
};

/**
 * This uses ajax to get the state from the database
 * based on the id (shortlink) provided.
 * @param {string} id - The shortlink/id to state
 */
gisportal.ajaxState = function(id) { 
   // Async to get state object
   
   $.ajax({
      url: gisportal.stateLocation + '/' + id,
      dataType: 'json',
      success: function( data ) {         
         gisportal.setState( data );
         //console.log('Success! State retrieved');
      },
      error: function( request ){
         //console.log('Error: Failed to retrieved state. The server returned a ' + data.output.status);
      }
   });
};

/**
 * This zooms the map so that all of the selected layers
 * fit into the viewport.
 */
gisportal.zoomOverall = function()  {
   if (Object.keys(gisportal.selectedLayers).length > 0)  {

      // minX, minY, maxX, maxY
      var largestBounds = [ 180, 90, -180, -90 ];

      for (var i = 0; i < gisportal.selectedLayers.length; i++)  {
         var bbox = gisportal.layers[gisportal.selectedLayers[i]].exBoundingBox;
         var MinX = bbox.WestBoundLongitude;
         var MinY = bbox.SouthBoundLatitude;
         var MaxX = bbox.EastBoundLongitude;
         var MaxY = bbox.NorthBoundLatitude;
         if (+MinX < +largestBounds[0]) largestBounds[0] = parseFloat(MinX); // left 
         if (+MinY < +largestBounds[1]) largestBounds[1] = parseFloat(MinY); // bottom
         if (+MaxX > +largestBounds[2]) largestBounds[2] = parseFloat(MaxX); // right 
         if (+MaxY > +largestBounds[3]) largestBounds[3] = parseFloat(MaxY); // top
      }

      var extent = gisportal.reprojectBoundingBox(largestBounds, 'EPSG:4326', gisportal.projection);
      map.getView().fit(extent, map.getSize());
   }
};

/**
 * Replace links on start splash from config file
 * Should probably be using Mustache for this
 */
gisportal.initStart = function()  {
   
   // Work out if we should skip the splash page
   // Should we auto resume ?
   // Do we have to show the T&C box first ?
   var autoLoad = null;
   if( gisportal.config.skipWelcomePage === true || gisportal.utils.getURLParameter('wms_url')){
      if( gisportal.config.autoResumeSavedState === true && gisportal.hasAutoSaveState() ){
         autoLoad = function(){ gisportal.loadState( gisportal.getAutoSaveState() ); gisportal.launchMap();};
      }else{
         autoLoad = function(){ gisportal.launchMap(); };
      }
   }else if( gisportal.config.autoResumeSavedState === true && gisportal.hasAutoSaveState() ){
      autoLoad = function(){ gisportal.loadState( gisportal.getAutoSaveState() ); gisportal.launchMap();};
   }

   if( autoLoad !== null)
      return setTimeout(autoLoad, 1000);

   // Splash page parameters
   var data = {
      homepageSlides  : gisportal.config.homepageSlides,
      hasAutoSaveState: gisportal.hasAutoSaveState(),
      startHTML: gisportal.config.startPageHTML
   };

   // Render the spasl page HTML
   var rendered = gisportal.templates.start( data );
   $('.js-start-container').html( rendered );

   // Start JS slider library
   window.mySwipe = new Swipe($('.homepageSlider')[0] , {
     speed: 800,
     auto: 3000,
     continuous: true,
     disableScroll: false,
   });


   // If clicked - Load the users previously saved state
   $('.js-load-last-state').click(function(){
      gisportal.launchMap();
      gisportal.loadState( gisportal.getAutoSaveState() );
   });
   
   // Make the terms and conditions template
   $('.js-tac-content').html( gisportal.templates['terms-and-conditions-text']() );

   $('.js-tac-accept').click(function(){
      gisportal.storage.set( 'tac-agreed', true );
      $('.js-tac-popup').toggleClass('hidden', true);
      gisportal.launchMap();
   });


   $('.js-tac-decline').click(function(){
      $('.js-tac-popup').toggleClass('hidden', true);
   });


   $('.js-start').click(function()  {

      if( gisportal.config.requiresTermsAndCondictions === true &&  gisportal.hasAgreedToTermsAndCondictions() === false ){
         $('.js-tac-popup').toggleClass('hidden', false);
      }else{
         gisportal.launchMap();
      }

   });
};

/**
 * Hides the start menu and launches the main part of the port
 * @return {[type]} [description]
 */
gisportal.launchMap = function(){

   $('.start').toggleClass('hidden', true);

   setInterval( gisportal.autoSaveState, 60000 );

   //Once they are past the splash page warn them if they leave
   window.onbeforeunload = function(){
      gisportal.autoSaveState();
      if( gisportal.config.siteMode == "production")
         return "Warning. Your about to leave the page";
      else
         return;
   };

};

/**
 * Returns if the user has agree to the
 * terms and conditions in the past
 * @return {Boolean} True is they have agreed, False if not
 */
gisportal.hasAgreedToTermsAndCondictions = function(){
   return gisportal.storage.get( 'tac-agreed', false );
};

/**
 * Sends all error to get sentry.
 */
gisportal.startRemoteErrorLogging = function(){
   
   $.getScript('//cdn.ravenjs.com/1.1.15/jquery,native/raven.min.js')
   .done(function(){
      Raven.config('https://552996d22b5b405783091fdc4aa3664a@app.getsentry.com/30024', {}).install();
      window.onerror = function(e){
         var extra = {};
   
         //Attempt to store information about the error.
         try{
            extra.state = JSON.stringify(gisportal.saveState());
   
            if( window.event && window.event.target && $.contains( window.document.body, window.event.target ) )
               extra.domEvemtTarget =  $( window.event.target ).html();
         }catch(err){}
   
         Raven.captureException(e, { extra: extra} );
      };
   });
};


/**
 * Check the users version of the portal is valid.
 *  - If the browser is valid it return true
 *  - If the browser is NOT valid is returns false and those an error
 */

gisportal.validateBrowser = function(){
   if( gisportal.config.browserRestristion == void(0) )
      return true;

   var level = gisportal.config.browserRestristion;
   if( level == "none" )
      return true;

   var requirements = [ 'svg', 'boxsizing', 'csscalc','inlinesvg' ];

   var valid = true;
   for(var i =  0; i < requirements.length; i++ ){
      valid = (valid &&  Modernizr[requirements[i]] );
   }
   if( valid )
      return true;

   if( gisportal.config.browserRestristion == "advisory" ){
      alert('Your browser is out of date, this site will not work correctly, if at all.');
      return false;
   }else if( gisportal.config.browserRestristion == "strict" ){
      $('.js-browse-not-compatible').show();
      $('.js-start').hide();
      return false;
   }else{
      throw new Error( 'Invalid config.browserRestristion value "' + gisportal.config.browserRestristion + '"' );
   }

};


/**
 *  Gets the value at the user selected point for all currently loaded layers
 *  
 */
gisportal.getPointReading = function(e) {
   
   var elementId = '#dataValue'+ String(e.coordinate[0]).replace('.','') + String(e.coordinate[1]).replace('.','');
   var feature_found = false;
   $.each(gisportal.selectedLayers, function(i, selectedLayer) {
      if(gisportal.pointInsideBox(e.coordinate, gisportal.layers[selectedLayer].exBoundingBox)){
         feature_found = true;
         var layer = gisportal.layers[selectedLayer];
         // build the request URL, starting with the WMS URL
         var request = layer.wmsURL;
         var pixel = e.pixel;
         var bbox = map.getView().calculateExtent(map.getSize());

         request += 'LAYERS=' + layer.urlName;
         if (layer.elevation) {
            // add the currently selected elevation
         } else {
            request += '&ELEVATION=0';
         }
         request += '&TIME=' + layer.selectedDateTime;
         request += '&TRANSPARENT=true';
         request += '&CRS='+ gisportal.projection;
         request += '&COLORSCALERANGE='+ layer.minScaleVal +','+ layer.maxScaleVal;
         request += '&NUMCOLORBANDS=253';
         request += '&LOGSCALE=false';
         request += '&SERVICE=WMS&VERSION=1.1.1';
         request += '&REQUEST=GetFeatureInfo';
         request += '&EXCEPTIONS=application/vnd.ogc.se_inimage';
         request += '&FORMAT=image/png';
         request += '&SRS='+ gisportal.projection;
         request += '&BBOX='+ bbox;
         request += '&X='+ pixel[0];
         request += '&Y='+ pixel[1];
         request += '&QUERY_LAYERS='+ layer.urlName;
         request += '&WIDTH='+ $('#map').width();
         request += '&HEIGHT='+ $('#map').height();
         request += '&url='+ layer.wmsURL;
         request += '&server='+ layer.wmsURL;


         $.ajax({
            url:  gisportal.middlewarePath + '/settings/load_data_values?url=' + encodeURIComponent(request) + '&name=' + layer.descriptiveName + '&units=' + layer.units,
            success: function(data){
               try{
                  $(elementId +' .loading').remove();
                  $(elementId).prepend('<li>'+ data +'</li>');
               }
               catch(e){
                  $(elementId +' .loading').remove();
                  $(elementId).prepend('<li>Sorry, feature information unavailable for: '+ layer.descriptiveName +'</li>');
               }
            },
            error: function(e){
               $(elementId +' .loading').remove();
               $(elementId).prepend('<li>Sorry, feature information unavailable for: '+ layer.descriptiveName +'</li>');
            }
         });
      }
   });
   if(!feature_found){
      $(elementId +' .loading').remove();
      $(elementId).prepend('<li>Sorry, you have clicked outside the bounds of all layers</li>');
   }
   
};
/**
 *    Returns true if the coordinate is inside the bounding box provided.
 *    Returns false otherwise
 */
gisportal.pointInsideBox = function(coordinate, exBoundingBox){
   // as the exBoundingBox is defined as EPSG:4326 first reproject the coordinate
   var point = gisportal.reprojectPoint(coordinate, gisportal.projection, 'EPSG:4326');
   point[0] = gisportal.normaliseLongitude(point[0], 'EPSG:4326');

   return point[0] >= exBoundingBox.WestBoundLongitude && point[0] <= exBoundingBox.EastBoundLongitude && point[1] >= exBoundingBox.SouthBoundLatitude && point[1] <= exBoundingBox.NorthBoundLatitude;
};

/**
 * When clicking on a map where the date line has been crossed returns the latitude incorrectly, e.g. scroll west over the date
 * line and click on Hobart and you get -212 degrees. This function corrects this 
 * 
 * @param  {[type]} coordinate      Reported longitude of the point on the map
 * @param  {[type]} projection_code The projection from which to use the bounds
 * @return {[type]}                 corrected longitude that's within the bounds of the projection
 */
gisportal.normaliseLongitude = function(coordinate, projection_code){
   var bounds = gisportal.availableProjections[projection_code].bounds;

   while(coordinate <= bounds[0]){
      coordinate += Math.abs(bounds[0] + bounds[0]);
   }
   while(coordinate >= bounds[2]){
      coordinate -= Math.abs(bounds[2] + bounds[2]);
   }
   return coordinate;
};

/**
 *  Hides all ol popups/overlays
 */
gisportal.hideAllPopups = function() {
   var overlays = map.getOverlays().getArray();

   $.each(overlays, function(i, overlay) {
      overlay.setPosition(undefined);
   });
};

gisportal.showModalMessage = function(html, timeout) {
   var t = parseInt(timeout) || 2000;
   var holder = $('.js-modal-message-popup');
   var target = $('.js-modal-message-html');

   target.html(html);
   holder.toggleClass('hidden', false);
   setTimeout(function() {
      holder.toggleClass('hidden', true);
   }, t);
};

// This function gets a list of all the available tags
gisportal.loadBrowseCategories = function(data){
   // This takes a category (cat) in a versatile format e.g. indicator_type
   addCategory = function(cat){
      // If the category is not in the list already
      if(!(cat in gisportal.browseCategories || cat == "niceName" || cat == "providerTag")){
         // Add the category name as a key and convert it to a nice view for the value
         gisportal.browseCategories[cat] = gisportal.utils.titleCase(cat.replace(/_/g, ' '));
      }
   };
   gisportal.browseCategories = {};
   var category, layer;
   // If data is give (first loading of portal)
   // Loop through each of the tags and run it through the addCategory function
   if(data){
      for(var obj in data){
         for(var server in data[obj].server){
            for(var layers in data[obj].server[server]){
               for(category in data[obj].server[server][layers].tags){
                  addCategory(category);
               }
            }
         }
      }
      for(layer in gisportal.vectors){
         for(category in gisportal.vectors[layer].tags){
            addCategory(category);
         }
      }
   // Any other time
   // Loop through each of the tags in gisportal.layers and run it through the addCategory function
   }else{
      for(layer in gisportal.layers){
         for(category in gisportal.layers[layer].tags){
            addCategory(category);
         }
      }
   }
   for(category in gisportal.config.hiddenCategories){
      var deleteCat = gisportal.config.hiddenCategories[category];
      delete gisportal.browseCategories[deleteCat];
      console.log("Removing '" + deleteCat + "' category");
   }
};
