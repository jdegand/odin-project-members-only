const express = require("express");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

const mongoDb = "MONGO CONNECTION STRING W/ USERNAME PASSWORD DATABASE GOES HERE";
mongoose.connect(mongoDb, { useUnifiedTopology: true, useNewUrlParser: true }); //don't need options with Mongoose 6?

const db = mongoose.connection;
db.on("error", console.error.bind(console, "mongo connection error"));

const messageSchema = new Schema({
  title: { type: String, required: true },
  date: { type: Date, default: Date.now },
  text: { type: String, required: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true }
});

const Message = mongoose.model("Message", messageSchema)

const User = mongoose.model(
  "User",
  new Schema({
    username: { type: String, required: true },
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    password: { type: String, required: true },
    membership: { type: Boolean, required: true },
    admin: { type: String, default: false } 
  })
);

const app = express();
app.set('views', path.join(__dirname, 'views'));
app.set("view engine", "ejs");

app.use(session({ secret: "cats", resave: false, saveUninitialized: true }));

passport.use(
    new LocalStrategy((username, password, done) => {
      User.findOne({ username: username }, (err, user) => {
        if (err) { 
          return done(err);
        }
        if (!user) {
          return done(null, false, { message: "Incorrect username" });
        }
        
        if(bcrypt.compare(password, user.password, (err, res) => {
            if (res) {
              // passwords match! log user in
              return done(null, user)
            } else {
              // passwords do not match!
              return done(null, false, { message: "Incorrect password" })
            }
          }))

        return done(null, user);
      });
    })
);

passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

app.use(passport.initialize());
app.use(passport.session());

app.use(function(req, res, next) {
    res.locals.currentUser = req.user;
    next();
});

app.use(express.urlencoded({ extended: false }));

app.get("/", (req, res, next) => {

  Message.find({}).populate('user_id').then((data)=> {
    // populate sends all fields -  isn't this a problem?
    res.render("index", {user: req.user, data:data})
  }).catch((error)=> {
    res.status(500).send(error)
  })

});

app.get("/log-out", (req, res) => {
    req.logout();
    res.redirect("/");
});

app.get("/sign-up", (req, res) => res.render("sign-up"));

app.get("/member", (req,res)=> res.render("join-club"));
app.get("/message", (req,res)=> res.render("message"));

app.post(
  '/member',
  body('secretcode').isLength({ min: 6 }),
  (req, res, next) => {
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userToUpdate = new User(res.locals.currentUser);

    if(req.body.secretcode === 'johnny'){
      //console.log(req.session.passport.user); //use this with findByIdAndUpdate ?
      
      userToUpdate.membership = true;

      User.findByIdAndUpdate(res.locals.currentUser, userToUpdate, {}, function(err){
        if(err){
          return next(err)
        }
        res.redirect("/");
      })
    } else {
      res.redirect("/member");
    }

  },
);

app.post(
  '/message',
  body('title').isLength({ min: 2 }),
  body('text').isLength({min: 2}),
  (req, res, next) => {
    // Finds the validation errors in this request and wraps them in an object with handy functions
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const newMessage = new Message({
			title: req.body.title,
			date: Date.now(),
			text: req.body.text,
			user_id: res.locals.currentUser._id
		});

		newMessage.save();
		res.redirect('/');
    
  }
);

app.post('/delete-message/:id', (req, res, next)=> {

  Message.findByIdAndRemove(req.params.id, function(err1, doc1) {
    if(err1) console.log(err1)
    console.log('findByIdAndRemove doc: ', doc1);
    Message.find({}, function(err2, docs) {
      if(err2) console.log(err2)
      console.log('Finding all: ', docs)
    })
  })
	res.redirect('/');

})

app.post(
  '/sign-up',
  body('firstname').isLength({ min: 2 }),
  body('lastname').isLength({min: 2}),
  // username must be an email
  body('username').isEmail(),
  // password must be at least 5 chars long
  body('password').isLength({ min: 5 }),
   (req, res, next) => {
    // Finds the validation errors in this request and wraps them in an object with handy functions
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    bcrypt.hash(req.body.password, 10, (err, hashedPassword) => {
      const user = new User({
          firstname: req.body.firstname,
          lastname: req.body.lastname,
          username: req.body.username,
          password: hashedPassword,
          admin: req.body.admin, 
          membership: false,
        }).save(err => {
          if (err) { 
            return next(err);
          }
          res.redirect("/");
        });
    });
  },
);

app.post(
    "/log-in",
    passport.authenticate("local", {
      successRedirect: "/",
      failureRedirect: "/"
    })
);

app.listen(3000, () => console.log("app listening on port 3000!"));