//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate"); // used with the google auth

//const encrypt = require("mongoose-encryption"); // we used md5 instead
// const md5 = require("md5"); //used bcyptt instead

// const bcrypt = require("bcrypt"); // for hasshing of password
// const saltRounds = 10; // salt rounds for bcrypt. hashes 10 times.

//Using 'passport' authentication instead of bccrypt authentiction



const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));

//set up session
app.use(session({
    secret: "Our secrete.",
    resave: false,
    saveUninitialized: false
}));

//initialize passport and use session
app.use(passport.initialize());
app.use(passport.session());

// // Connetion URL
// const url = 'mongodb://localhost:27017';

// //Database Name
// const dbName = "userDB";

// // Create a new MongoClient
// const client = new MongoClient(url); //This will connect to our database(fruitsDB) through the url
// // if fruitsDB does not exist, it creates it.

// // Use connect method to connect to the Server
// client.connect(function(err) { 
//     assert.equal(null, err); // check for error, if none then connects
//     console.log("connected successfully to server"); 

//     const db = client.db(dbName);

//     client.close();
// });

//connection url
const url = "mongodb://127.0.0.1:27017/userDB"

// connect to Database
mongoose.connect(url, { 
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(function(){
    console.log("Database connected successfully.");
})
.catch(err => console.log(err));
mongoose.set("useCreateIndex", true); // this is to stop deprecation warning


//create schema i.e the datatype in each column of a model(table like in sql)
const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String
});

//Hash and salt the password and save in the database
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// //encrption of password using mongoose encryption. must be above the model.
// const secret1 = process.env.SECRET; // SECRET is in the .env file
// userSchema.plugin(encrypt, {secret: secret1, encryptedFields: ['password']}); // Only encrypt password. To encrypt more, use ["passord", "age", "email"]

// We are creating a table/collection of users
//Model or table or collection. must be singlar word and starts with capital letter i.e User instead of users.
const User = new mongoose.model("User", userSchema);

//passport local strategy to authentcate user using password and username
//and serialize - creates cookie to save the password and username
//and deserialize - crumbles the cookie when user logs out.
// serialization and deserialization is only used when using sessions.
passport.use(User.createStrategy());

// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());
//OR
passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      cb(null, { id: user.id, username: user.username, name: user.name });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });
 //OR
//   passport.serializeUser(function(user, done) {
//     done(null, user.id);
//   });
  
//   passport.deserializeUser(function(id, done) {
//     User.findById(id, function(err, user) {
//       done(err, user);
//     });
//   });

//google auth
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);

    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


app.get("/", function(req, res){
    res.render("home");
});

app.get("/auth/google",
    passport.authenticate('google', { scope: ["profile"] })// User's profile on google to authenticate 
  );

app.get("/login", function(req, res){
    res.render("login");
});

app.get("/auth/google/secrets", 
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  });

app.get("/register", function(req, res){
    res.render("register");
});

app.get("/secrets", function (req, res) { 
    User.find({"secret": {$ne: null}}, function (err, foundUsersSecret) {
        if (err){
            console.log(er);
        } else {
            if (foundUsersSecret) {
                res.render("secrets", {UserWithSecrets: foundUsersSecret});
            }
        }
      })
    
    // if (req.isAuthenticated()){
    //     res.render("secrets");
    // } else {
    //     res.redirect("/login");
    // }
 });

app.get("/submit", function (req, res) {
    if (req.isAuthenticated()){
        res.render("submit");
    } else {
        res.redirect("/login");
    }
  })


app.post("/submit", function (req, res) {
    const submittedSecret = req.body.secret;

    User.findById(req.user.id, function (err, foundUser) {
        if (err) {
            console.log(err);
        } else {
            if (foundUser) {
                foundUser.secret = submittedSecret;
                foundUser.save(function() {
                    res.redirect("/secrets");
                })
            }
        }
      });
  })

app.get("/logout", function (req, res) {
    //res.redirect("/");
    //Or
    //req.logout();
    //Or
    res.render("home");
        
});

//First time registration
app.post("/register", (req, res)=>{
    User.register({username: req.body.username}, req.body.password, function(err, user){
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function () { 
                res.redirect("/secrets");
             });
        }
    });
});


app.post("/login", (req, res)=>{
    const user = new User({
        username: req.body.username,
        password: req.body.password
    })

    req.login(user, function (err) { 
        if (err){
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");
              });
        }
     })
});



app.listen(3000, function(){
    console.log("server started on port 3000.");
});