Example usage:

    var csvparser = require('csvparser');

    var stream = fs.ReadStream(file);
    var onrow = function(row) {
    
    };
    
    csvparser.parse(stream, {headers:true, onrow: onrow});
    
If the headers option is set to true, the values in the first row are considered column names.
the onrow callback is not called for the first row and 
the callback receives an object with the column names as attributes.
If a certain row contains more values that columns are specified in the header, these values will be cut off.

If the headers option is set to false, the onrow callback is called for all rows, including the first one.
The callback receives an array in this case.

Below a reference of all available options with their default value:

    {
    	headers: true,
    	separator: ',',
    	encoding: "utf8",
    	onrow: null
    }