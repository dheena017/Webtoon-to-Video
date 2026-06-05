import JSZip from "jszip";
const zip = new JSZip();
zip.file("hello.txt", "Hello World\n");
zip.generateAsync({type:"nodebuffer"}).then(function(content) {
    console.log("ZIP created successfully. length:", content.length);
}).catch(err => {
    console.error("error:", err);
});
