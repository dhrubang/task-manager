const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');

app.set("view engine" , "ejs");
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname , 'public')));


app.get('/', (req, res) => {
    fs.readdir(`./files` , function (err , files) {
        res.render("index" ,  {files : files});  // data send
        console.log("ALso  Working");
        
    })
});

app.post('/create', function(req, res)  {
   fs.writeFile(`./files/${req.body.title.split(' ').join('')}.txt`, req.body.details , function(err){
    res.redirect("/");
    console.log("Working ")
   })
});

// create route for  read more 
// use utf8 that it read and give me English data otherwise it give me buffer data

app.get('/file/:filename', (req, res) => {
   fs.readFile(`./files/${req.params.filename}`, "utf-8" , function(err , filedata){
        res.render("showfiles" , {filename:req.params.filename  ,filedata:filedata})
   })
});


//For edit
app.get('/edit/:filename', (req, res) => {
   res.render("edit")
 });
app.listen(3000, () => {
    console.log('Server running on port 3000');
});

