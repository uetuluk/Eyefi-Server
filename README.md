# Eyfi-Server 
A standalone Node.js server for the EyefiMobiPro Wifi Cards based on the work of michaelbrandt. https://github.com/michaelbrandt/node-eyefimobiserver

About this Repo:
This project is based on the work of michaelbrandt @Github: https://github.com/michaelbrandt/node-eyefimobiserver.
The original Project allready implemented a full solution for the wifi transfer, but with newer versions of node and other used packages it doesn´t work anymore. The issues seem to affect only the multipart request, that contain the files send by the sd-card.
Because of that huge parts of the code, all about the xml handling and parsing, that sets up and controlls the connection with the sd card, have been copied from michaelbrandts git-repo and slightly modified to work properly especial with newer versions of node.
The changes I made are basicly, that the XML-Part does not get written anymore to an attribute in the request, because it seems that this causes the problem with the multipart handling. Instead the XML Data gets now written to a global var and is parsed after the end of the Data stream is reached. As mentioned above, all the xml-parsing and creating the response, is copied from michaelbrands Repo (Everything form line 40 to 182).
The "getCredential()" function has been ported from michaelbrandt from Python File by Maximilian Golla.

The Multipart-Handling is rewritten by me, SuperMario4848. The datastream gets parsed by "formidable"-framework and the received archive is saved under "uploads/archives". After the the "tar" module is used to extract the archives and save them under "uploads/pictures". Each archive is deleted after it has been extracted. The console prints if a picture gets uploaded, if it has been received and when it has been extracted.

Other References:
Upload-Protocol of the Eyefi-Card: https://code.google.com/p/sceye-fi/wiki/UploadProtocol
Work of Maximilian Golla, original code for "getCredential()" function: https://github.com/michaelbrandt/node-eyefimobiserver/blob/master/related_work/eyefi-mobi.py

How to use:
To use this server, simply download the repo and unzip it. DO NOT RENAME ANY FOLDER. Before using, all dependencies need to be installed. A package-lock.json is included so executing "npm install" in the same dir as the server.js should do it. After that, just connect your pc to the wifi of the card and run "node server.js". After some time you should see a "upload in progress" Message. If the upload of one file has finished it tells you "name + uploaded". This means that the tar-archive, that contains your image, has been saved under "uploads/archives". It will automatically be extracted and deleted after that, so all your images will be found under "uploads/pictures".

Feel free to open an issue if something doesn´t work for you.