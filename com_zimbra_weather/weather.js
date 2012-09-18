/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * Zimbra Collaboration Suite Zimlets
 * Copyright (C) 2006, 2007 Zimbra, Inc.
 *
 * The contents of this file are subject to the Yahoo! Public License
 * Version 1.0 ("License"); you may not use this file except in
 * compliance with the License.  You may obtain a copy of the License at
 * http://www.zimbra.com/license.
 *
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
 *
 * ***** END LICENSE BLOCK *****
 *@Author Sankar Tanguturi
 */

function trimString(s) {
	s = s.replace(/(^\s+|\s+$)/gi, "");
	s = s.replace(/[ ]{2,}/gi," ");
	return s;
}

function com_zimbra_weather() {
	this._brTag = '<br/>';
	this._noWeatherInformationFoundHTML = '' +
		'Could not get the weather information. Try the following tips: '+ this._brTag +
		'1. Try again.' + this._brTag +
		'2. Make sure you have entered a proper zip code.' + this._brTag +
		'3. Clear the zip code and try again.' + this._brTag +
		'';
	this._timerID = null;
	this._SHOW_WEATHER_MINICAL_USER_PROPERTY = 'show_weather_minical';
	this._WEATHER_ZIPCODE_USER_PROPERTY = 'weather_zipcode';
	this._AUTO_IP = 'autoip';
	this._currentWeatherCondition = '';
}
com_zimbra_weather.prototype = new ZmZimletBase();
com_zimbra_weather.prototype.constructor = com_zimbra_weather;

com_zimbra_weather._urlBase = "http://api.wunderground.com/api/<your_api_key>/conditions/forecast7day/hourly/q/";
com_zimbra_weather._defaultOutputFormat = ".json";


//--------------------------------------
//		CODE THAT FETCHES Weather Information
//--------------------------------------

com_zimbra_weather.prototype._invoke =
function(postCallback) {
    var zipcode = this.getUserProperty(this._WEATHER_ZIPCODE_USER_PROPERTY);
    try {
       zipcode = trimString(zipcode);
    } catch (err) {
        // Ignore the error;
    }
    if (!zipcode) {
    	zipcode = this._AUTO_IP;
    } else if (zipcode === '') {
    	zipcode = this._AUTO_IP;
    }
    
    var fullWeatherUrl = com_zimbra_weather._urlBase +
    					 zipcode +
    					 com_zimbra_weather._defaultOutputFormat;
    					 
	var ajaxUrl = ZmZimletBase.PROXY + AjxStringUtil.urlComponentEncode(fullWeatherUrl);
	
	AjxRpc.invoke(null, ajaxUrl, null, new AjxCallback(this, this._reponseHandler, postCallback), true);
	
	return;
};

com_zimbra_weather.prototype._reponseHandler =
function(postCallback, response) {
    if (response.success == false) {
		this._showErrorMsg('' +
			' Error: REST api failed' +
			'<br/>' +
			this._noWeatherInformationFoundHTML +
			'');
		return;
    }
    
    var jsonObject = null;
    try {
    	jsonObject = json_parse(response.text);
    } catch (e) {
		this._showErrorMsg('' +
			this._noWeatherInformationFoundHTML +
			'<br/>' +
			'Error: ' + e);
		return;
    }

    if(postCallback)
	   postCallback.run(this, jsonObject);

    return;
};

com_zimbra_weather.prototype._showErrorMsg =
function(msg) {
	var msgDialog = appCtxt.getMsgDialog();
	msgDialog.reset();
	msgDialog.setMessage(msg, DwtMessageDialog.CRITICAL_STYLE);
	msgDialog.popup();
};


//--------------------------------------
//		USER INTERACTION HANDLERS
//--------------------------------------
com_zimbra_weather.prototype.doubleClicked =
function() {	
	this.singleClicked();
};

com_zimbra_weather.prototype.singleClicked =
function() {
	this._executeAction(false, false, false);
};

com_zimbra_weather.prototype._showMiniCalView =
function() {
	this._clearWeatherInMiniCal();
	this._executeAction(false, false, true);
}

com_zimbra_weather.prototype._executeAction = 
function (showNext7Days, showNext8Hours, showInMiniCal) {
	var postCallback = new AjxCallback(this, this._displayWeatherDialog, [showNext7Days, showNext8Hours, showInMiniCal]);
	this._invoke(postCallback);
};

com_zimbra_weather.prototype.menuItemSelected = function(itemId) {
	switch (itemId) {
		case "change_zipcode":
			this._displayPrefDialog();
			break;
		case "weather_next_8hours":
			this._executeAction(false, true, false);
			break;
		case "weather_next_7days":
			this._executeAction(true, false, false);
			break;
		case "weather_overview":
			this._executeAction(true, true, false);
			break;			
	}
};

com_zimbra_weather.prototype._showWeatherInMiniCal = function(weatherHTML) {

	if(!this._miniCal) {
		var calController = AjxDispatcher.run("GetCalController");
		this._miniCal = calController ? calController.getMiniCalendar().getHtmlElement() : null;
	}

    if (!this._newDiv) {
        this._newDiv = document.createElement("div");
        this._newDiv.id = "weather_minical_div";
        this._newDiv.style.zIndex = 900;
		this._newDiv.style.width = 163;
        this._newDiv.style.backgroundColor = "white";
	    document.getElementById("skin_container_tree_footer").appendChild(this._newDiv);            
    }
    // temporarily hide the mini calendar
    this._miniCal.style.visibility = "hidden";
	this._newDiv.innerHTML = weatherHTML;
	
	if (this._timerID) {
		clearTimeout(this._timerID);
		this._timerID = null;
	}
	this._timerID = setInterval(AjxCallback.simpleClosure(this._showMiniCalView, this), 20 * 60 * 1000);
};

com_zimbra_weather.prototype._clearWeatherInMiniCal = function() {	
	
	if (this._timerID) {
		clearTimeout(this._timerID);
		this._timerID = null;
	}
	
	if(!this._miniCal) {
		var calController = AjxDispatcher.run("GetCalController");
		this._miniCal = calController ? calController.getMiniCalendar().getHtmlElement() : null;
	}
	
	this._miniCal.style.visibility = "visible";
};
//--------------------------------------
//		DIALOG VIEW
//--------------------------------------
com_zimbra_weather.prototype._displayWeatherDialog =
function(showNext7Days, showNext8Hours, showInMiniCal, thisObject, jsonObject) {
	var weatherHTML = '';
	
	try {
		weatherHTML = this._constructDialogView(jsonObject, showNext7Days, showNext8Hours, showInMiniCal);
	} catch (e) {
		this._showErrorMsg('' +
			this._noWeatherInformationFoundHTML +
			'<br/>' +
			'Error: ' + e);
		return;	
	}
	
	if (showInMiniCal) {
		this._showWeatherInMiniCal(weatherHTML);
		return;
	}

	if (!this.weatherDlg) {
		this._parentView = new DwtComposite(this.getShell());
	}

	this._parentView.getHtmlElement().style.overflow = "auto";	
	this._parentView.getHtmlElement().innerHTML = weatherHTML;

	if (!this.weatherDlg) {
		this.weatherDlg = this._createDialog({title:"Weather Information", view:this._parentView, standardButtons : [DwtDialog.OK_BUTTON]});
	}
	this.weatherDlg.popup();
	return;
};

com_zimbra_weather.prototype._constructDialogView =
function(jsonObject, showNext7Days, showNext8Hours, optimizeForMiniCal) {
	var html = new Array();
	var i = 0;
	var tempHTML = '';
	var brTag = '<br/>' ;

	var current_observation = jsonObject.current_observation;
	var display_location = null;
	if (current_observation) {
		display_location = current_observation.display_location;
	}
	
	if (!current_observation || !display_location) {
		return this._noWeatherInformationFoundHTML;		   
	}
	
	var topBannerDiv = '';

	topBannerDiv =  '' +
		'<div>' +
			((optimizeForMiniCal) ? '' : '<b>Weather</b> for  ') + 
			'<b>' +
				display_location.full + ' ' +
				display_location.country + ' ' +
				display_location.zip +
			'</b>' +
		'</div>' +
		'';
	
	tempHTML = '' +
		'<table>' +
			'<tr>'+
				'<th>&nbsp;</th>' +
				'<th>Present Weather</th>' +
			'</tr>' +
			'<tr>' +
				'<td>' +
					'<div>&nbsp;</div>' +
					'<div>' +
						'<img src="' + current_observation.icon_url + '" ' +
							 'alt="' + current_observation.weather + '" ' +
						'/>'+
					'</div>' +
				'</td>' +
				'<td>' +
					'<div>&nbsp;</div>' +
					'<div>' + '<b>' + current_observation.temperature_string + '</b>' +'</div>' +
					'<div>' +  current_observation.weather + '</div>' +
					'<div>' + 'Wind: ' + current_observation.wind_dir + ' at ' + current_observation.wind_mph + ' mph</div>' +
					'<div>' + 'Humidity: ' + current_observation.relative_humidity + '</div>' +					
				'</td>' +				
			'</tr>' +
		'</table>' +
		'';
	
	html[i++] = tempHTML;
	
	if (this._currentWeatherCondition != current_observation.weather) {
		this._currentWeatherCondition = current_observation.weather;
		appCtxt.getAppController().setStatusMsg("Present Weather: " + this._currentWeatherCondition + "");
	}
	

	if (!optimizeForMiniCal && showNext7Days) {
		var forecastDays = jsonObject.forecast.simpleforecast.forecastday;
		for (var l = 0; l < forecastDays.length ; l++) {
			var day = forecastDays[l];
				if (!day.date ||
					!day.date.weekday_short ||
					!day.icon_url ||
					!day.conditions ||
					!day.high ||
					!day.high.fahrenheit ||
					!day.high.celsius ||
					!day.low ||
					!day.low.fahrenheit ||
					!day.low.celsius) {
				continue;
			}
			tempHTML  = '' +
				'<div>' +
					'<div>' + 
							((l == 0) ? 'Today' : day.date.weekday_short ) +
					'</div>' +
					'<div>' +
						'<img src="' + day.icon_url + '" '+
				        	   'alt="' + day.conditions + '" ' +
						'/>' +
					'</div>' +
					'<div>' + day.conditions + '</div>' +
					'<div>' + 
						'<b>' + day.high.fahrenheit + '<sup>o</sup>' + ' F</b>' +
						' ' +
						'(' + day.high.celsius + '<sup>o</sup> C)' +
					'<div>' +
					'<div>' + 
						'<b>' + day.low.fahrenheit + '<sup>o</sup>' + ' F</b>' +
						' ' +
						'(' + day.low.celsius + '<sup>o</sup> C)' +
					'<div>' +					
				'</div>' +
				'';
			html[i++] = tempHTML;
		}
	} // if (showNext7Days)
	
	var fullForecast = '<table>'+ '<tr>';
	for (i = 0; i < html.length; i++) {
		fullForecast += '<td align="center">' + html[i] + '</td>';
		fullForecast += '<td><div>&nbsp;</div></td>';
	}
	fullForecast += '</tr>' + '</table>' ;
	
	html = new Array();
	i = 0;

	var fullHourForecast = '';
	
	if (!optimizeForMiniCal && showNext8Hours) {
		var hourlyForecast = jsonObject.hourly_forecast;
		for (var l = 0; l < 8 ; l++) {
			var hour = hourlyForecast[l];
				if (!hour || !hour.FCTTIME || !hour.icon_url || !hour.condition) {
				continue;
			}
			tempHTML  = '' +
					'<div>' + hour.FCTTIME.civil + '</div>' +
					'<img src="' + hour.icon_url + '" '+
								   'alt="' + hour.condition + '" ' +
					'/>' +
					'<div>' + hour.condition + '</div>' +
					'<div> Humidity: ' + hour.humidity + '</div>' +
					'<div>' + 
						'<b>' + hour.temp.english + '</b>' + '<sup>o</sup> F ' +
						' | ' +
						hour.temp.metric + '<sup>o</sup> C' +
					'</div>' +
				'';
			html[i++] = tempHTML;
		}	
		
		fullHourForecast = '<div><b>Hourly forecast for next 8 hours</div>';
		fullHourForecast += this._brTag;
		
		fullHourForecast += '<table>'+ '<tr>';
		for (i = 0; i < html.length; i++) {
			fullHourForecast += '<td align="center">' + html[i] + '</td>';
			fullHourForecast += '<td><div>&nbsp;</div></td>';
		}
		fullHourForecast += '</tr>' + '</table>' ;
	}
	
	var linksHTML = '';
	linksHTML = '' +
		'<div>' +
			'<b>Source</b>: ' + '<a href="http://www.wunderground.com">Weather Underground</a>' +
		'</div>' +
		this._brTag +
		'';
	
	if (!optimizeForMiniCal) {
		linksHTML += '' +
			'<div><b>Resources</b>: ' +
				'Detailed <a href="' + current_observation.forecast_url + '"> Forecast</a>' +
				',&nbsp;'+
				'Detailed <a href="' + current_observation.history_url + '"> History</a>' +
			'</div>'+
			'';
	}

	var weatherHTML = '';
	
	weatherHTML = [topBannerDiv,
				     this._brTag,
				   fullForecast,
				   	this._brTag,
				   fullHourForecast,
					this._brTag,
				   linksHTML].join('');	

	return weatherHTML;
};

com_zimbra_weather.prototype._displayPrefDialog =
function() {
	//if zimlet dialog already exists...
	if (this.pbDialog) {
		this.pbDialog.popup();
		return;
	}
	this.pView = new DwtComposite(this.getShell());
	this.pView.getHtmlElement().innerHTML = this._createPreferenceView();
	
	if (document.getElementById(this._WEATHER_ZIPCODE_USER_PROPERTY)) {
		document.getElementById(this._WEATHER_ZIPCODE_USER_PROPERTY).value = this.getUserProperty(this._WEATHER_ZIPCODE_USER_PROPERTY);
	}

	//var readMeButtonId = Dwt.getNextId();
	//var readMeButton = new DwtDialog_ButtonDescriptor(readMeButtonId, ("Read Me"), DwtDialog.ALIGN_LEFT);
	this.pbDialog = this._createDialog({title:"Zimlet Preferences", view:this.pView, standardButtons:[DwtDialog.OK_BUTTON]});
	this.pbDialog.setButtonListener(DwtDialog.OK_BUTTON, new AjxListener(this, this._okBtnListner));
	//this.pbDialog.setButtonListener(readMeButtonId, new AjxListener(this, this._showReadMe));
	this.pbDialog.popup();
};


com_zimbra_weather.prototype._createPreferenceView =
function() {
	var html = new Array();
	var i = 0;
	html[i++] = "<div>";
	html[i++] = "	Please enter the zipcode: (Valid only in US)";
	html[i++] = '	<input id="' + this._WEATHER_ZIPCODE_USER_PROPERTY +'" type="text"/>';
	html[i++] = "	<br/>";
	html[i++] = '	<input id="' + this._SHOW_WEATHER_MINICAL_USER_PROPERTY + '" type="checkbox"/> Auto-refresh weather information and display in Mini Calendar area.';
	html[i++] = "</div>";
	return html.join("");
};


com_zimbra_weather.prototype._okBtnListner =
function() {
	var zipChanged = false;
	var showInMiniCalPrefChanged = false;
	var newValue;
	
    if (document.getElementById(this._WEATHER_ZIPCODE_USER_PROPERTY)) {
    	newValue = document.getElementById(this._WEATHER_ZIPCODE_USER_PROPERTY).value;
    	if (newValue != this.getUserProperty(this._WEATHER_ZIPCODE_USER_PROPERTY)) {
    		zipChanged = true;
			this.setUserProperty(this._WEATHER_ZIPCODE_USER_PROPERTY, newValue, true);
    	}
	}
	
	if (document.getElementById(this._SHOW_WEATHER_MINICAL_USER_PROPERTY)) {
		newValue = document.getElementById(this._SHOW_WEATHER_MINICAL_USER_PROPERTY).checked;
		if (newValue != this.getUserProperty(this._SHOW_WEATHER_MINICAL_USER_PROPERTY)) {
			showInMiniCalPrefChanged = true;
			this.setUserProperty(this._SHOW_WEATHER_MINICAL_USER_PROPERTY, newValue, true) ;
		}
	}
	
	if (zipChanged || showInMiniCalPrefChanged) {
		if (newValue) {
			this._showMiniCalView();
		} else {
			this._clearWeatherInMiniCal();
		}
	}
	
	this.pbDialog.popdown();
};

/*
    http://www.JSON.org/json_parse.js
    2011-03-06

    Public Domain.

    NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.

    This file creates a json_parse function.

        json_parse(text, reviver)
            This method parses a JSON text to produce an object or array.
            It can throw a SyntaxError exception.

            The optional reviver parameter is a function that can filter and
            transform the results. It receives each of the keys and values,
            and its return value is used instead of the original value.
            If it returns what it received, then the structure is not modified.
            If it returns undefined then the member is deleted.

            Example:

            // Parse the text. Values that look like ISO date strings will
            // be converted to Date objects.

            myData = json_parse(text, function (key, value) {
                var a;
                if (typeof value === 'string') {
                    a =
/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(value);
                    if (a) {
                        return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4],
                            +a[5], +a[6]));
                    }
                }
                return value;
            });

    This is a reference implementation. You are free to copy, modify, or
    redistribute.

    This code should be minified before deployment.
    See http://javascript.crockford.com/jsmin.html

    USE YOUR OWN COPY. IT IS EXTREMELY UNWISE TO LOAD CODE FROM SERVERS YOU DO
    NOT CONTROL.
    
    https://raw.github.com/douglascrockford/JSON-js/master/json_parse.js
*/

/*members "", "\"", "\/", "\\", at, b, call, charAt, f, fromCharCode,
    hasOwnProperty, message, n, name, prototype, push, r, t, text
*/

var json_parse = (function () {
    "use strict";

// This is a function that can parse a JSON text, producing a JavaScript
// data structure. It is a simple, recursive descent parser. It does not use
// eval or regular expressions, so it can be used as a model for implementing
// a JSON parser in other languages.

// We are defining the function inside of another function to avoid creating
// global variables.

    var at,     // The index of the current character
        ch,     // The current character
        escapee = {
            '"':  '"',
            '\\': '\\',
            '/':  '/',
            b:    '\b',
            f:    '\f',
            n:    '\n',
            r:    '\r',
            t:    '\t'
        },
        text,

        error = function (m) {

// Call error when something is wrong.

            throw {
                name:    'SyntaxError',
                message: m,
                at:      at,
                text:    text
            };
        },

        next = function (c) {

// If a c parameter is provided, verify that it matches the current character.

            if (c && c !== ch) {
                error("Expected '" + c + "' instead of '" + ch + "'");
            }

// Get the next character. When there are no more characters,
// return the empty string.

            ch = text.charAt(at);
            at += 1;
            return ch;
        },

        number = function () {

// Parse a number value.

            var number,
                string = '';

            if (ch === '-') {
                string = '-';
                next('-');
            }
            while (ch >= '0' && ch <= '9') {
                string += ch;
                next();
            }
            if (ch === '.') {
                string += '.';
                while (next() && ch >= '0' && ch <= '9') {
                    string += ch;
                }
            }
            if (ch === 'e' || ch === 'E') {
                string += ch;
                next();
                if (ch === '-' || ch === '+') {
                    string += ch;
                    next();
                }
                while (ch >= '0' && ch <= '9') {
                    string += ch;
                    next();
                }
            }
            number = +string;
            if (!isFinite(number)) {
                error("Bad number");
            } else {
                return number;
            }
        },

        string = function () {

// Parse a string value.

            var hex,
                i,
                string = '',
                uffff;

// When parsing for string values, we must look for " and \ characters.

            if (ch === '"') {
                while (next()) {
                    if (ch === '"') {
                        next();
                        return string;
                    } else if (ch === '\\') {
                        next();
                        if (ch === 'u') {
                            uffff = 0;
                            for (i = 0; i < 4; i += 1) {
                                hex = parseInt(next(), 16);
                                if (!isFinite(hex)) {
                                    break;
                                }
                                uffff = uffff * 16 + hex;
                            }
                            string += String.fromCharCode(uffff);
                        } else if (typeof escapee[ch] === 'string') {
                            string += escapee[ch];
                        } else {
                            break;
                        }
                    } else {
                        string += ch;
                    }
                }
            }
            error("Bad string");
        },

        white = function () {

// Skip whitespace.

            while (ch && ch <= ' ') {
                next();
            }
        },

        word = function () {

// true, false, or null.

            switch (ch) {
            case 't':
                next('t');
                next('r');
                next('u');
                next('e');
                return true;
            case 'f':
                next('f');
                next('a');
                next('l');
                next('s');
                next('e');
                return false;
            case 'n':
                next('n');
                next('u');
                next('l');
                next('l');
                return null;
            }
            error("Unexpected '" + ch + "'");
        },

        value,  // Place holder for the value function.

        array = function () {

// Parse an array value.

            var array = [];

            if (ch === '[') {
                next('[');
                white();
                if (ch === ']') {
                    next(']');
                    return array;   // empty array
                }
                while (ch) {
                    array.push(value());
                    white();
                    if (ch === ']') {
                        next(']');
                        return array;
                    }
                    next(',');
                    white();
                }
            }
            error("Bad array");
        },

        object = function () {

// Parse an object value.

            var key,
                object = {};

            if (ch === '{') {
                next('{');
                white();
                if (ch === '}') {
                    next('}');
                    return object;   // empty object
                }
                while (ch) {
                    key = string();
                    white();
                    next(':');
                    if (Object.hasOwnProperty.call(object, key)) {
                        error('Duplicate key "' + key + '"');
                    }
                    object[key] = value();
                    white();
                    if (ch === '}') {
                        next('}');
                        return object;
                    }
                    next(',');
                    white();
                }
            }
            error("Bad object");
        };

    value = function () {

// Parse a JSON value. It could be an object, an array, a string, a number,
// or a word.

        white();
        switch (ch) {
        case '{':
            return object();
        case '[':
            return array();
        case '"':
            return string();
        case '-':
            return number();
        default:
            return ch >= '0' && ch <= '9' ? number() : word();
        }
    };

// Return the json_parse function. It will have access to all of the above
// functions and variables.

    return function (source, reviver) {
        var result;

        text = source;
        at = 0;
        ch = ' ';
        result = value();
        white();
        if (ch) {
            error("Syntax error");
        }

// If there is a reviver function, we recursively walk the new structure,
// passing each name/value pair to the reviver function for possible
// transformation, starting with a temporary root object that holds the result
// in an empty key. If there is not a reviver function, we simply return the
// result.

        return typeof reviver === 'function' ? (function walk(holder, key) {
            var k, v, value = holder[key];
            if (value && typeof value === 'object') {
                for (k in value) {
                    if (Object.prototype.hasOwnProperty.call(value, k)) {
                        v = walk(value, k);
                        if (v !== undefined) {
                            value[k] = v;
                        } else {
                            delete value[k];
                        }
                    }
                }
            }
            return reviver.call(holder, key, value);
        }({'': result}, '')) : result;
    };
}());
