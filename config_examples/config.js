/*------------------------------------*\
   Configuration
   This file is for the configuration
   of the GIS Portal.

   browseCategories - Used to define
   which categories to be shown in the
   browse panel. This is currently
   limited to 2.
\*------------------------------------*/



gisportal.config = {
   siteMode: "development", //(development|production)
   browseCategories : {
      "Ecosystem_Element" : "Ecosystem",
      "region": "Region",
      "MSFD" : "EU MSFD"
   },
   paths: {
    graphServer: 'http://localhost:3000/',
    middlewarePath: '/service'
   },
   countryBorder : {
      'defaultLayer' : 'countries_all_white',      // (countries_all_white|countries_all_black|countries_all_blue)
      'alwaysVisible' : false                      // (true|false)  > If true the defaultLayer will be visible at page load
   },
   collaborationFeatures : {
      enabled : true,                              // (true|false) > If false the collaboration tab will be hidden
      protocol : 'http';                           // 'http' or 'https'; the connection is automagically upgraded to a websocket connection
      host : 'pmpc1465.npm.ac.uk';                 // the hostname of the node server running collaboration/index.js
      port : '6789';                               // must match the port specified in collaboration/config/config.js
      path : '';                                   // optional path; must start with a /
   },
   defaultBaseMap : "GEBCO",
   // Should layers auto scale by default
   autoScale: true,

   requiresTermsAndCondictions: true,

   homepageSlides: [
      "img/homepage-slides/opec1.jpg",
      "img/homepage-slides/opec2.jpg",
      "img/homepage-slides/opec3.jpg",
      "img/homepage-slides/opec4.jpg",
      "img/homepage-slides/opec5.jpg",
      "img/homepage-slides/opec6.jpg",
      "img/homepage-slides/opec7.jpg"
   ]
   

};

