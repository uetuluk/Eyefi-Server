/**
This project is based on the work of michaelbrandt @Github.
Huge parts of the code, all about the xml handling and parsing, have been copied
from his git-repo: "https://github.com/michaelbrandt/node-eyefimobiserver" and slightly modified to work properly
especial with newer versions of node. The Multipart-Handling is rewritten by me, SuperMario4848. See README for more Details.
*/


var express = require("express");
var formidable = require("formidable");
var parseString = require('xml2js').parseString;
var md5 = require('md5');
var iconv = require('iconv-lite');
var md5 = require('md5');
var Buffer = require('buffer').Buffer;
var randomstring = require("randomstring");
var fs = require("fs");
var tar = require("tar");
var url = require("url");


var PORT = 59278;

var verbose = false;
var snonceStorage = "";
var snonceStorageLock = false;
var key = "00000000000000000000000000000000"; // Key is always 00..0
var archiveDir = "../uploads/archives";
var imageDir = "../uploads/pictures";
var xmlBuffer = "";
var currentFilename = "";

var app = express();
var server = app.listen(PORT);

// Put a friendly message on the terminal
console.log("Server running at http://127.0.0.1:" + PORT + "/");




// creates a new random generated Server Number Used Once (SNONCE), different for every datatransfer
function getNewSnonce() {
    return md5(randomstring.generate(40));
}

//get the stored snonce and disables the lock for storing a new snonce
function getStoredSnonce() {
    snonceStorageLock = false;
    return snonceStorage;
}

//saves the snonce created in StartSession-request and locks this information until the credential from the SD Card is authenticated in GetPhotoStatus-request.
// Info: The SD Card will not start up the next process unless  authentication for the last process is done, so this should be unnecessary, but.. you know..just in case ;)
function setStoredSnonce(snonceToStore) {
    if (snonceStorageLock === false) {
        snonceStorage = snonceToStore;
        snonceStorageLock = true;
    }
}

function msg(debugMsg) {
    if (verbose) {
        console.log(debugMsg);
    }
}

// computes the credentials for authentication, code ported from Python File by Maximilian Golla
function get_credential(string) {
    var beforeMD5 = Buffer.from("");
    for (var i = 0; i < string.length; i += 2) {
        var chunk = string[i] + string[i + 1];
        var hexval = "0x" + chunk;
        var dec = parseInt(hexval, 16);
        var myByte = iconv.encode(String.fromCharCode(dec), "latin1");
        beforeMD5 = Buffer.concat([beforeMD5, myByte]);
    }
    return md5(beforeMD5)
};

//catching and handling the XML post requests. XML gets stored in XML buffer.
app.post('/api/soap/eyefilm/v1', (req, res, next) => {

    req.on("data", function (chunck) {
        xmlBuffer += chunck;
    });
    req.on("end", function () {
        var headerValue = req.headers.soapaction;

        if (headerValue == "\"urn:StartSession\"") {
            msg("Got StartSession request");
            var mac = '';
            var cnonce = '';
            var transfermode = '';
            var transfermodetimestamp = '';
            var credential_server_to_client = '';

            parseString(xmlBuffer, function (err, result) {
                var extract = result['SOAP-ENV:Envelope']['SOAP-ENV:Body'][0]['ns1:StartSession'][0];
                mac = extract['macaddress'][0];
                cnonce = extract['cnonce'][0];
                transfermode = extract['transfermode'][0];
                transfermodetimestamp = extract['transfermodetimestamp'][0];
                xmlBuffer = "";
            });

            var temporarySnonce = getNewSnonce();
            setStoredSnonce(temporarySnonce);
            res.send('<?xml version="1.0" encoding="UTF-8"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Body><ns1:StartSessionResponse xmlns:ns1="http://localhost/api/soap/eyefilm"><credential>' + get_credential(mac + cnonce + key) + '</credential><snonce>' + temporarySnonce + '</snonce><transfermode>' + transfermode + '</transfermode><transfermodetimestamp>' + transfermodetimestamp + '</transfermodetimestamp><upsyncallowed>false</upsyncallowed></ns1:StartSessionResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>');

        } else if (headerValue == "\"urn:GetPhotoStatus\"") {
            msg("Got GetPhotoStatus request");
            var mac = '';
            var filename = '';
            var filesize = '';
            var filesignature = '';
            var flags = '';

            parseString(xmlBuffer, function (err, result) {
                var extract = result['SOAP-ENV:Envelope']['SOAP-ENV:Body'][0]['ns1:GetPhotoStatus'][0];
                credential_client_to_server = extract['credential'][0];
                mac = extract['macaddress'][0];
                filename = extract['filename'][0];
                filesize = extract['filesize'][0];
                filesignature = extract['filesignature'][0];
                flags = extract['flags'][0];
                xmlBuffer = "";
            });
            if (get_credential(mac + key + getStoredSnonce()) == credential_client_to_server) {
                currentFilename = filename.substring(0, filename.length - 4);
                res.send('<?xml version="1.0" encoding="UTF-8"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Body><ns1:GetPhotoStatusResponse xmlns:ns1="http://localhost/api/soap/eyefilm"><fileid>' + 1 + '</fileid><offset>0</offset></ns1:GetPhotoStatusResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>');
            } else {
                //this could mean someone tries to attack the server
                msg("Eye-Fi SD card failed to authenticate. File " + filename + " not received. ");
                res.send('Nice try!');
            }
        } else if (headerValue == "\"urn:MarkLastPhotoInRoll\"") {
            msg("Got MarkLastPhotoInRoll request");
            res.send('<?xml version="1.0" encoding="UTF-8"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Body> <ns1:MarkLastPhotoInRollResponse xmlns:ns1="http://localhost/api/soap/eyefilm" /></SOAP-ENV:Body> </SOAP-ENV:Envelope>');
        } else {
            msg("Unknow Request");
            res.send('Unknown Request');
        }

    });
});

//catching and handling the multipart request. Each contains one image as tar-archive. Multipart-Content parsed with "formidable" and archive extracted with "tar". Archives get deleted after extraction.
app.post('/api/soap/eyefilm/v1/upload', (req, res, next) => {
    var imageName = currentFilename;
    console.log("Upload of " + imageName + " in progress");
    previousFilename = currentFilename;
    const form = formidable({
        multiples: true,
        uploadDir: archiveDir,
        keepExtensions: true
    });

    form.parse(req, (err, fields, files) => {
        if (err) {
            console.error(err);
            next(err);
            return;
        }

        res.send('<?xml version="1.0" encoding="UTF-8"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Body><ns1:UploadPhotoResponse xmlns:ns1="http://localhost/api/soap/eyefilm"><success>true</success></ns1:UploadPhotoResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>');

        console.log(imageName + " uploaded");
        
        var archive = files.FILENAME.path;

        var tarOptions = {
            file: archive,
            cwd: imageDir
        }

        tar.x(tarOptions, "", function () {
            console.log("Image extracted: " + imageName);
            fs.unlink(archive, function(){
                console.log("Deleted uploaded archive " + archive);
            })
        });
    });

});
