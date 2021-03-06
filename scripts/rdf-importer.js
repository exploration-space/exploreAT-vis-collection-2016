
// skos:definition -> scientific name
// ontolex:writtenRep -> common name
// lexinfo:usageNote -> common name type
// skos:inScheme -> source
// geonames:name -> geography



var fs = require('fs'),
    xml2js = require('xml2js');
    _ = require('underscore')._;

var elasticsearch = require('elasticsearch');

var client = new elasticsearch.Client({
    log: 'trace',
    hosts: [getESHost()]
    //hosts: ['localhost:9200']
});


var entries = [];
var entryURIS = [];


var parser = new xml2js.Parser();

indexMultipleInstances();
//indexUniqueInstances();
//indexCondensedInstances();

function indexMultipleInstances(){

    fs.readFile('public/data/plants.rdf', function(err, data) {
        parser.parseString(data, function (err, result) {
            //console.log(result);

            var rdfContents = result['rdf:RDF']['rdf:Description'];

            var bulk_request = [];

            rdfContents.forEach(function(item) {

                var entry = {};
                if (item['$'] != undefined) {                    entry.URI = item['$']['rdf:about'];
                    entry.URItype = entry.URI.split("dboe/")[1].split("/")[0]; }
                if (item['dc:source'] != undefined)              entry.region = item['dc:source'][0];
                if (item['geonames:name'] != undefined)          entry.geography = item['geonames:name'][0];
                if (item['lexinfo:usageNote'] != undefined)      entry.commonNameType = item['lexinfo:usageNote'][0];
                if (item['ontolex:isEvokedBy'] != undefined)     {if(item['ontolex:isEvokedBy'][0]['$']['rdf:resource'] != "h" && item['ontolex:isEvokedBy'][0]['$']['rdf:resource'] != "t") entry.evokedByEntryWithURI = item['ontolex:isEvokedBy'][0]['$']['rdf:resource'];}
                if (item['ontolex:lexicalForm'] != undefined)    entry.lexicalFormURI = item['ontolex:lexicalForm'][0]['$']['rdf:resource'];
                if (item['ontolex:writtenRep'] != undefined)     entry.language = item['ontolex:writtenRep'][0]['$']['xml:lang'];
                if (item['ontolex:writtenRep'] != undefined)     entry.commonName = item['ontolex:writtenRep'][0]['_'];
                if (item['rdf:type'] != undefined && item['rdf:type'].length > 0) {
                    if (item['rdf:type'].length < 2) {
                        entry.type = item['rdf:type'][0]['$']['rdf:resource'];
                    }
                    else {
                        var types = item['rdf:type'];
                        entry.type = [];
                        _.forEach(types, function (theType) {
                            entry.type.push(theType['$']['rdf:resource']);
                        });
                    }
                }
                if (item['rdfs:comment'] != undefined)       entry.comment = item['rdfs:comment'][0];
                if (item['skos:definition'] != undefined)    entry.scientificName = item['skos:definition'][0];
                if (item['skos:inScheme'] != undefined)      entry.source = item['skos:inScheme'][0]['$']['rdf:resource'];
                if (item['skos:related'] != undefined)       entry.relatedURI = item['skos:related'][0]['$']['rdf:resource'];

                bulk_request.push({index: {_index: 'rdf-plants-raw', _type: 'rdf-plants-raw-type'}});
                bulk_request.push(entry);
            });

            //index and flush
            return esClient.bulk({
                body: bulk_request
            });

            console.log('Done');
            process.exit(0);
        });
    });

}


function indexUniqueInstances(){

    fs.readFile('public/data/plants.rdf', function(err, data) {
        parser.parseString(data, function (err, result) {
            //console.log(result);

            var rdfContents = result['rdf:RDF']['rdf:Description'];

            rdfContents.forEach(function(item) {

                // Create new entry only if its URI is not known yet
                if(entryURIS.indexOf(item['$']['rdf:about']) < 0) {

                    entryURIS.push(item['$']['rdf:about']);

                    var entry = {};
                    if (item['$'] != undefined) {                    entry.URI = item['$']['rdf:about'];
                        entry.URItype = entry.URI.split("dboe/")[1].split("/")[0]; }
                    if (item['dc:source'] != undefined)              entry.region = item['dc:source'][0];
                    if (item['geonames:name'] != undefined)          entry.geography = item['geonames:name'][0];
                    if (item['lexinfo:usageNote'] != undefined)      entry.commonNameType = item['lexinfo:usageNote'][0];
                    if (item['ontolex:isEvokedBy'] != undefined)     {if(item['ontolex:isEvokedBy'][0]['$']['rdf:resource'] != "h" && item['ontolex:isEvokedBy'][0]['$']['rdf:resource'] != "t") entry.evokedByEntryWithURI = item['ontolex:isEvokedBy'][0]['$']['rdf:resource'];}
                    if (item['ontolex:lexicalForm'] != undefined)    entry.lexicalFormURI = item['ontolex:lexicalForm'][0]['$']['rdf:resource'];
                    if (item['ontolex:writtenRep'] != undefined)     entry.language = item['ontolex:writtenRep'][0]['$']['xml:lang'];
                    if (item['ontolex:writtenRep'] != undefined)     entry.commonName = item['ontolex:writtenRep'][0]['_'];
                    if (item['rdf:type'] != undefined && item['rdf:type'].length > 0) {
                        if (item['rdf:type'].length < 2) {
                            entry.type = item['rdf:type'][0]['$']['rdf:resource'];
                        }
                        else {
                            var types = item['rdf:type'];
                            entry.type = [];
                            _.forEach(types, function (theType) {
                                entry.type.push(theType['$']['rdf:resource']);
                            });
                        }
                    }
                    if (item['rdfs:comment'] != undefined)       entry.comment = item['rdfs:comment'][0];
                    if (item['skos:definition'] != undefined)    entry.scientificName = item['skos:definition'][0];
                    if (item['skos:inScheme'] != undefined)      entry.source = item['skos:inScheme'][0]['$']['rdf:resource'];
                    if (item['skos:related'] != undefined)       entry.relatedURI = item['skos:related'][0]['$']['rdf:resource'];


                    entries.push(entry);
                }

                else {

                    // Find the entry and add the new fields (array-style)

                    var fetchedEntry = _.find(entries, function (theEntry) {
                        return theEntry.URI == item['$']['rdf:about'];
                    })


                    var entry = {};
                    if (item['$'] != undefined)                      entry.URI = item['$']['rdf:about'];
                    if (item['dc:source'] != undefined)              entry.region = item['dc:source'][0];
                    if (item['geonames:name'] != undefined)          entry.geography = item['geonames:name'][0];
                    if (item['lexinfo:usageNote'] != undefined)      entry.commonNameType = item['lexinfo:usageNote'][0];
                    if (item['ontolex:isEvokedBy'] != undefined)     {if(item['ontolex:isEvokedBy'][0]['$']['rdf:resource'] != "h" && item['ontolex:isEvokedBy'][0]['$']['rdf:resource'] != "t") entry.evokedByEntryWithURI = item['ontolex:isEvokedBy'][0]['$']['rdf:resource'];}
                    if (item['ontolex:lexicalForm'] != undefined)    entry.lexicalFormURI = item['ontolex:lexicalForm'][0]['$']['rdf:resource'];
                    if (item['ontolex:writtenRep'] != undefined)     entry.language = item['ontolex:writtenRep'][0]['$']['xml:lang'];
                    if (item['ontolex:writtenRep'] != undefined)     entry.commonName = item['ontolex:writtenRep'][0]['_'];
                    if (item['rdf:type'] != undefined && item['rdf:type'].length > 0) {
                        if (item['rdf:type'].length < 2) {
                            entry.type = item['rdf:type'][0]['$']['rdf:resource'];
                        }
                        else {
                            var types = item['rdf:type'];
                            entry.type = [];
                            _.forEach(types, function (theType) {
                                entry.type.push(theType['$']['rdf:resource']);
                            });
                        }
                    }
                    if (item['rdfs:comment'] != undefined)       entry.comment = item['rdfs:comment'][0];
                    if (item['skos:definition'] != undefined)    entry.scientificName = item['skos:definition'][0];
                    if (item['skos:inScheme'] != undefined)      entry.source = item['skos:inScheme'][0]['$']['rdf:resource'];
                    if (item['skos:related'] != undefined)       entry.relatedURI = item['skos:related'][0]['$']['rdf:resource'];


                    var mergedEntry = deepmerge(fetchedEntry, entry);
                    mergedEntry.URI = item['$']['rdf:about'];

                    _.extend(_.findWhere(entries, { URI: mergedEntry.URI }), mergedEntry);
                }
            });

            // Flatten array of arrays into one single array full of different values
            function flatten (arr) {
                var newArr = [];
                for (var i = 0; i < arr.length; i++) {
                    if (Array.isArray(arr[i])) {
                        var temp = flatten(arr[i]);
                        temp.forEach(function(value){ newArr.push(value); })
                    } else {
                        newArr.push(arr[i]);
                    }
                }
                return newArr;
            }

            // Make an array out of the references from other URIs
            _.forEach(entries, function (entryToIndex) {
                var evokedURIs = [];
                if(entryToIndex.evokedByEntryWithURI != undefined) {
                    if(entryToIndex.evokedByEntryWithURI.length > 1){
                        evokedURIs.push(entryToIndex.evokedByEntryWithURI[1]);
                        entryToIndex.evokedByEntryWithURI = flatten(entryToIndex.evokedByEntryWithURI[0]);
                        entryToIndex.evokedByEntryWithURI.push(evokedURIs[0]);
                        entryToIndex.evokedByEntryWithURI = _.uniq(entryToIndex.evokedByEntryWithURI);
                        _.extend(_.findWhere(entries, { URI: entryToIndex.URI }), entryToIndex);
                    }
                }
            });

            // Remove "h" and "t" evokedByURI array entries (trash)
            _.forEach(entries, function (entryToIndex) {
                if(entryToIndex.evokedByEntryWithURI != undefined) {
                    if(entryToIndex.evokedByEntryWithURI.length > 1){
                        var idxToRemove = [];
                        var i;
                        _.forEach(entryToIndex.evokedByEntryWithURI, function(uri, idx){
                            if(uri.length == 1) idxToRemove.push(idx);
                        });
                        while((i = idxToRemove.pop()) != null){
                            entryToIndex.evokedByEntryWithURI.splice(i, 1);
                        }
                    }
                }
            });


            var bulk_request = [];

            _.forEach(entries, function (entryToIndex) {

                bulk_request.push({index: {_index: 'rdf-plants', _type: 'rdf-plants-type'}});
                bulk_request.push(entryToIndex);
            });

            //index and flush
            return client.bulk({
                body: bulk_request
            }, function () {
                console.log('Done');
                process.exit(0);
            });

        });
    });

}



function indexCondensedInstances(){

    fs.readFile('public/data/plants.rdf', function(err, data) {
        parser.parseString(data, function (err, result) {
            //console.log(result);

            var rdfContents = result['rdf:RDF']['rdf:Description'];

            rdfContents.forEach(function(item) {

                // Create new entry only if its URI is not known yet
                var composedURI = /*item['$']['rdf:about'].split("/")[item['$']['rdf:about'].split("/").length-2] +
                        "/" + */item['$']['rdf:about'].split("/")[item['$']['rdf:about'].split("/").length-1];
                if(entryURIS.indexOf(composedURI) < 0) {

                    entryURIS.push(composedURI);

                    var entry = {};
                    if (item['$'] != undefined) {
                        entry.URI = item['$']['rdf:about'];
                        entry.URIid = item['$']['rdf:about'].split("/")[item['$']['rdf:about'].split("/").length-1];
                        entry.URItype = entry.URI.split("dboe/")[1].split("/")[0];
                        entry.URIcondensed = /*entry.URItype + "/" + */entry.URIid;
                    }
                    if (item['dc:source'] != undefined)              entry.region = item['dc:source'][0];
                    if (item['geonames:name'] != undefined)          entry.geography = item['geonames:name'][0];
                    if (item['lexinfo:usageNote'] != undefined)      entry.commonNameType = item['lexinfo:usageNote'][0];
                    if (item['ontolex:isEvokedBy'] != undefined)     {if(item['ontolex:isEvokedBy'][0]['$']['rdf:resource'] != "h" && item['ontolex:isEvokedBy'][0]['$']['rdf:resource'] != "t") entry.evokedByEntryWithURI = item['ontolex:isEvokedBy'][0]['$']['rdf:resource'];}
                    if (item['ontolex:lexicalForm'] != undefined)    entry.lexicalFormURI = item['ontolex:lexicalForm'][0]['$']['rdf:resource'];
                    if (item['ontolex:writtenRep'] != undefined)     entry.language = item['ontolex:writtenRep'][0]['$']['xml:lang'];
                    if (item['ontolex:writtenRep'] != undefined)     entry.commonName = item['ontolex:writtenRep'][0]['_'];
                    if (item['rdf:type'] != undefined && item['rdf:type'].length > 0) {
                        if (item['rdf:type'].length < 2) {
                            entry.type = item['rdf:type'][0]['$']['rdf:resource'];
                        }
                        else {
                            var types = item['rdf:type'];
                            entry.type = [];
                            _.forEach(types, function (theType) {
                                entry.type.push(theType['$']['rdf:resource']);
                            });
                        }
                    }
                    if (item['rdfs:comment'] != undefined)       entry.comment = item['rdfs:comment'][0];
                    if (item['skos:definition'] != undefined)    entry.scientificName = item['skos:definition'][0];
                    if (item['skos:inScheme'] != undefined)      entry.source = item['skos:inScheme'][0]['$']['rdf:resource'];
                    if (item['skos:related'] != undefined)       entry.relatedURI = item['skos:related'][0]['$']['rdf:resource'];

                    entries.push(entry);
                }

                else {

                    // Find the entry and add the new fields (array-style)

                    var fetchedEntry = _.find(entries, function (theEntry) {
                        return theEntry.URIcondensed == /*item['$']['rdf:about'].split("/")[item['$']['rdf:about'].split("/").length-2] +
                            "/" + */item['$']['rdf:about'].split("/")[item['$']['rdf:about'].split("/").length-1];
                    })

                    var entry = {};
                    if (item['$'] != undefined){
                        entry.URI = item['$']['rdf:about'];
                        entry.URIid = item['$']['rdf:about'].split("/")[item['$']['rdf:about'].split("/").length-1];
                        entry.URItype = entry.URI.split("dboe/")[1].split("/")[0];
                        entry.URIcondensed = /*entry.URItype + "/" + */entry.URIid;
                    }
                    if (item['dc:source'] != undefined)              entry.region = item['dc:source'][0];
                    if (item['geonames:name'] != undefined)          entry.geography = item['geonames:name'][0];
                    if (item['lexinfo:usageNote'] != undefined)      entry.commonNameType = item['lexinfo:usageNote'][0];
                    if (item['ontolex:isEvokedBy'] != undefined)     {if(item['ontolex:isEvokedBy'][0]['$']['rdf:resource'] != "h" && item['ontolex:isEvokedBy'][0]['$']['rdf:resource'] != "t") entry.evokedByEntryWithURI = item['ontolex:isEvokedBy'][0]['$']['rdf:resource'];}
                    if (item['ontolex:lexicalForm'] != undefined)    entry.lexicalFormURI = item['ontolex:lexicalForm'][0]['$']['rdf:resource'];
                    if (item['ontolex:writtenRep'] != undefined)     entry.language = item['ontolex:writtenRep'][0]['$']['xml:lang'];
                    if (item['ontolex:writtenRep'] != undefined)     entry.commonName = item['ontolex:writtenRep'][0]['_'];
                    if (item['rdf:type'] != undefined && item['rdf:type'].length > 0) {
                        if (item['rdf:type'].length < 2) {
                            entry.type = item['rdf:type'][0]['$']['rdf:resource'];
                        }
                        else {
                            var types = item['rdf:type'];
                            entry.type = [];
                            _.forEach(types, function (theType) {
                                entry.type.push(theType['$']['rdf:resource']);
                            });
                        }
                    }
                    if (item['rdfs:comment'] != undefined)       entry.comment = item['rdfs:comment'][0];
                    if (item['skos:definition'] != undefined)    entry.scientificName = item['skos:definition'][0];
                    if (item['skos:inScheme'] != undefined)      entry.source = item['skos:inScheme'][0]['$']['rdf:resource'];
                    if (item['skos:related'] != undefined)       entry.relatedURI = item['skos:related'][0]['$']['rdf:resource'];


                    var mergedEntry = deepmerge(fetchedEntry, entry);
                    mergedEntry.URI = item['$']['rdf:about'];
                    mergedEntry.URIid = item['$']['rdf:about'].split("/")[item['$']['rdf:about'].split("/").length-1];
                    mergedEntry.URItype = mergedEntry.URI.split("dboe/")[1].split("/")[0];
                    mergedEntry.URIcondensed = /*mergedEntry.URItype + "/" + */mergedEntry.URIid;

                    var idx = _.indexOf(entries,fetchedEntry);
                    entries[idx] = mergedEntry;
                    //_.extend(_.findWhere(entries, { URI: mergedEntry.URI }), mergedEntry);
                }
            });

            // Flatten array of arrays into one single array full of different values
            function flatten (arr) {
                var newArr = [];
                for (var i = 0; i < arr.length; i++) {
                    if (Array.isArray(arr[i])) {
                        var temp = flatten(arr[i]);
                        temp.forEach(function(value){ newArr.push(value); })
                    } else {
                        newArr.push(arr[i]);
                    }
                }
                return newArr;
            }

            // Make an array out of the references from other URIs
            _.forEach(entries, function (entryToIndex) {
                var evokedURIs = [];
                if(entryToIndex.evokedByEntryWithURI != undefined) {
                    if(entryToIndex.evokedByEntryWithURI.length > 1){
                        evokedURIs.push(entryToIndex.evokedByEntryWithURI[1]);
                        entryToIndex.evokedByEntryWithURI = flatten(entryToIndex.evokedByEntryWithURI[0]);
                        entryToIndex.evokedByEntryWithURI.push(evokedURIs[0]);
                        entryToIndex.evokedByEntryWithURI = _.uniq(entryToIndex.evokedByEntryWithURI);
                        _.extend(_.findWhere(entries, { URI: entryToIndex.URI }), entryToIndex);
                    }
                }
            });


            // Remove "h" and "t" evokedByURI array entries (trash)
            _.forEach(entries, function (entryToIndex) {
                if(entryToIndex.evokedByEntryWithURI != undefined) {
                    if (entryToIndex.evokedByEntryWithURI.length > 1) {
                        var idxToRemove = [];
                        var i;
                        _.forEach(entryToIndex.evokedByEntryWithURI, function (uri, idx) {
                            if (uri.length == 1) idxToRemove.push(idx);
                        });
                        while ((i = idxToRemove.pop()) != null) {
                            entryToIndex.evokedByEntryWithURI.splice(i, 1);
                        }
                    }
                    if(entryToIndex.evokedByEntryWithURI.length == 0){
                        delete entryToIndex.evokedByEntryWithURI;
                    }
                }
            });


            var bulk_request = [];

            var entry = null;

            _.forEach(entries, function (entryToIndex) {

                bulk_request.push({index: {_index: 'rdf-plants-condensed', _type: 'rdf-plants-condensed-type'}});
                bulk_request.push(entryToIndex);
            });

            //index and flush
            return client.bulk({
                body: bulk_request
            }, function () {
                console.log('Done');
                process.exit(0);
            });

        });
    });

}


function deepmerge(foo, bar) {
    var merged = {};
    for (var each in bar) {
        if (foo.hasOwnProperty(each) && bar.hasOwnProperty(each)) {
            if (typeof(foo[each]) == "object" && typeof(bar[each]) == "object") {
                merged[each] = deepmerge(foo[each], bar[each]);
            } else {
                merged[each] = [foo[each], bar[each]];
            }
        } else if(bar.hasOwnProperty(each)) {
            merged[each] = bar[each];
        }
    }
    for (var each in foo) {
        if (!(each in bar) && foo.hasOwnProperty(each)) {
            merged[each] = foo[each];
        }
    }
    return merged;
}

//
// var ElasticsearchCSV = require('elasticsearch-csv');
//
// // create an instance of the importer with options
// var esCSV = new ElasticsearchCSV({
//     es: { index: 'nhlindex', type: 'nhltype', host: 'localhost:9200' },
//     csv: { filePath: 'public/data/dbFull.csv', headers: true }
// });
//
// console.log("import start")
//
// esCSV.import()
//     .then(function (response) {
//         console.log("import done")
//         // Elasticsearch response for the bulk insert
//         //console.log(response);
//     }, function (err) {
//         console.log("import error")
//         // throw error
//         throw err;
//     });
