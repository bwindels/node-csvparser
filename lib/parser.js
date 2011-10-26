/*
Copyright (c) 2011 Bruno Windels <bruno.windels@gmail.com>

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

//default values for the options, also serves
//as a reference to all the accepted options
var defaultOptions = {
	headers: true,
	separator: ',',
	encoding: "utf8",
	onrow: null
};
//when parse is called, we store the options in here 
//so they are available everywhere in this module
var options;

//since we allow for newlines inside of
//quoted strings, we need to keep state
//while parsing
var parserstate = {
	insideQuotes: false,
	row: [],
	valueChunks: [],
	headers: []
};
//called when we reach the end of a row
var finishRow = function() {
    var row = parserstate.row,
        obj;
    
    parserstate.row = [];
    
    if( options.headers && parserstate.headers.length === 0 ) {
        //only add headers while the header text is a non-empty string
        row.some( function(value) {
            value = value.trim();
            if(value === "") {
                return true;    //break out of row.some
            } else {
                parserstate.headers.push( value );
                return false;
            }
        } );
    } else {
        if( options.headers ) {
            obj = {};
            //create object with header names as attributes
            //copying only as much rows as there are headers
            parserstate.headers.forEach( function(name, i) {
                obj[ name ] = row[i];
            });
            row = obj;
        }
        if(typeof options.onrow === "function") {
            options.onrow( row );
        }
    }
};

//called when we reach the end of a column value
var finishValue = function(chunk, finishIndex) {
    //complete value
    parserstate.valueChunks.push( chunk.substring( 0, finishIndex ) );
    var value = parserstate.valueChunks.join("").trim();
    //save an re-init value
    parserstate.row.push( value );
    parserstate.valueChunks = [];
};

//parser logic
var parseInsideQuotes = function(chunk) {
    var index;
    
    if(!parserstate.insideQuotes) {
        return false;
    }
    index = chunk.indexOf('"');
    if(index === -1) {
        parserstate.valueChunks.push( chunk );
    } else {
        parserstate.valueChunks.push( chunk.substring(0, index) );
        ++index;    //skip quote from input
        parserstate.insideQuotes = false;
    }
    return index;
};

var parseOutsideQuotes = function(chunk) {
    if(parserstate.insideQuotes) {
        return false;
    }
    var indexSep = chunk.indexOf(options.separator),
        indexQuote = chunk.indexOf('"'),
        indexNewLine = chunk.indexOf('\n'),
        indices = [indexSep, indexQuote, indexNewLine],
        closest,
        value;
    //we want the smalles index the is not -1,
    //this is the index of the first character we
    //should take into account for splitting.
    //So we first filter out the -1's and then
    //sort numerically and take the first element if present
    indices = indices
        .filter(function(v) {return v !== -1;})
        .sort(function(a,b) {return a-b;});
        
    if(indices.length !== 0) {
        closest = indices[ 0 ];
        //finish value
        if(closest === indexSep) {
            finishValue( chunk, indexSep );
            //cut off separator
            return indexSep + 1;
        }
        else if(closest === indexNewLine) {
            finishValue( chunk, indexNewLine );
            finishRow();
            return indexNewLine + 1;
        } else if(closest === indexQuote) {
            parserstate.valueChunks.push( chunk.substring( 0, indexQuote ) );
            parserstate.insideQuotes = true;
            return indexQuote + 1;
        }
    } else {
        parserstate.valueChunks.push( chunk );
        return -1;
    }
};

//runs the parser logic and cuts up chunks as needed
var parsers = [ parseInsideQuotes, parseOutsideQuotes ];

var parsechunk = function(chunk) {
    //loop until the entire chunk is processed
    while(chunk.length !== 0) {
        parsers.some( function( parser ) {
            var result = parser(chunk), index;
            //the parser can return false if it does not want to
             //parse in the current parserstate, in which case we ask the next parser
            if(result === false) {
                return false;   //break out of parsers.some
            }
            //or the parser can return an integer meaning where the chunk should be
            //cut off for the next parse iteration
            else if(result === -1) {
                chunk = "";
            } else {
                result = Math.min(chunk.length, result);
                chunk = chunk.substring(result);
            }
            return true;
        } );
	}
};
//public api
var parse = function(stream, opts) {
    //copy options to an object that inherits from the default options
    options = Object.create(defaultOptions);
    Object.getOwnPropertyNames(opts).forEach(function(optName) {
        options[optName] = opts[optName];
    });
    stream.setEncoding(options.encoding);
    stream.addListener("data", parsechunk);
    stream.addListener("error", function() {
        throw "I/O error";
    });
    stream.resume();
};

module.exports = {
    parse: parse
};