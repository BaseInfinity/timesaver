var express = require('express'),
    passport = require('passport'),
    util = require('util'),
    GoogleStrategy = require('passport-google-oauth').OAuth2Strategy,
    app = express(),
    config = require('./config'),
    dateFormat = require('dateformat'),
    GoogleSpreadsheets = require('google-spreadsheets');

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new GoogleStrategy({
  clientID: config.google.CLIENT_ID,
  clientSecret: config.google.CLIENT_SECRET,
  callbackURL: config.google.CALLBACK_URL
}, function(accessToken, refreshToken, profile, done) {
  // asynchronous verification
  profile.accessToken = accessToken;
  process.nextTick(function() {
    return done(null, profile);
  });
}));

// configure Express
app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.logger());
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.session({ secret: config.session.SECRET }));
  // Initialize Passport!  Also use passport.session() middleware, to support
  // persistent login sessions (recommended).
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

function Cell (value, row, column) {
  this.value = value; 
  this.row = row;
  this.column = column;
}

app.get('/', function(req, res) {
  if (req.user) {
    var now = new Date();
    // THIS IS SUCH A HACK, USE A MODULE FOR LOCAL TIMEZONES
    now.setHours(now.getHours() - 8);
    GoogleSpreadsheets({
      auth: req.user.accessToken,
      key: config.SPREADSHEET_KEY
    },
    function(err, spreadsheet) {
      // quit being lazy and put this in a function
      if (!spreadsheet) {
        req.logout();
        res.render('error', { msg: "Spreadsheet not found. Make sure you have permission to view the spreadsheet."});
      } else {
        var worksheet = spreadsheet.worksheets[0];

        worksheet.cells(null, function(err, result) {
          var cells = result.cells;
          var dateRow = cells[2];
          var todaysDate = dateFormat(now, 'm/d/yyyy');
          var columnIndex;

          // Find the column for today's date
          for(var cell in dateRow) {
            console.log(dateRow[cell].value);
            if (dateRow[cell].value === todaysDate) {
              columnIndex = cell;
            }
          }

          var cellLocation = {
            row: '',
            column: columnIndex
          };

          var employee = {
            name: null,
            hours: {
              regular: null,
              overtime: null,
              makeup: null,
              total: null
            },
            lunchTaken: null
          };

          for(var row in cells) {
            // We don't care about the first 2 rows
            if (row > 2) {
              var nameCell = cells[row][2];
              var regularCell = cells[row][3];

              if (nameCell && nameCell.value === req.user.displayName) {
                employee.name = new Cell(nameCell.value, row, columnIndex);
                console.log(employee.name);
              }

              if (regularCell && employee.name) {
                console.log('found at row ' + row);

                try {
                  if (regularCell.value.match(/regular/i)) {
                    employee.hours.regular = new Cell(cells[row][columnIndex].value, row, columnIndex);
                  } else if (regularCell.value.match(/overtime/i)) {
                    employee.hours.overtime = new Cell(cells[row][columnIndex].value, row, columnIndex);
                  } else if (regularCell.value.match(/makeup/i)) {
                    employee.hours.makeup = new Cell(cells[row][columnIndex].value, row, columnIndex);
                  } else if (regularCell.value.match(/total/i)) {
                    employee.hours.total = new Cell(cells[row][columnIndex].value, row, columnIndex);
                  } else if (regularCell.value.match(/lunch/i)) {
                    employee.lunchTaken = new Cell(cells[row][columnIndex].value.toLowerCase() === 'yes' ? true : false, row, columnIndex);
                    break;
                  }
                } catch (err) {
                  console.log('got error!');
                  var errorMessage = 'One of your values on the spreadsheet is missing and is most likely blank';
                }
              }
            }
          }

          req.user.spreadsheet = { worksheetId: worksheet.id, spreadsheetId: config.SPREADSHEET_KEY };
          req.user.workInfo = employee;
          console.log('work ifno');
          console.log(req.user.workInfo);

          if (employee.name && !errorMessage) {
            res.render('index', { user: req.user });
          } else {
            var name = req.user.displayName;
            req.logout();
            res.render('error', { msg: errorMessage ? errorMessage : "Couldn't find you on the spreadsheet. Make sure your name '" + name + "' matches your name on the spreadsheet."});
          }
        });
      }
    });
  } else {
    res.redirect('/auth/google');
  }
});

app.get('/auth/google', 
  passport.authenticate('google', { 
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/drive',
      'https://spreadsheets.google.com/feeds'
    ]
  }), 
  function(req, res) {
    // The request will be redirected to Google  
  }
);

// GET /auth/google/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/google/callback', 
  passport.authenticate('google'),
  function(req, res) {
    res.redirect('/');
  }
);

var Spreadsheet = require('edit-google-spreadsheet');

app.post('/lunch',
  function(req, res) {
    Spreadsheet.create({
      debug:true,
      accessToken: {
        type: 'Bearer',
        token: req.user.accessToken
      },
      spreadsheetId: req.user.spreadsheet.spreadsheetId,
      worksheetId: req.user.spreadsheet.worksheetId,
      callback: function(err, spreadsheet) {
        req.user.workInfo.lunchTaken.value = req.body.lunchTaken ? 'Yes' : 'No';
        var lunchCell = req.user.workInfo.lunchTaken;
        var row = lunchCell.row;
        var column = lunchCell.column;


        var cellActionsRow = {};
        var cellActionsColumn = {};
        var cellActionsComplete = {};
        cellActionsColumn[lunchCell.column] = lunchCell.value;
        cellActionsRow[lunchCell.row] = cellActionsColumn;

        spreadsheet.add(cellActionsRow);
        spreadsheet.send(function(err) {
          res.json({'success' : true, 'lunchTaken' : req.user.workInfo.lunchTaken.value.toLowerCase() === 'yes' });
        });
      }
    });
    
    console.log(req.body);
  }
);

app.post('/hours',
  function(req, res) {
    Spreadsheet.create({
      debug:true,
      accessToken: {
        type: 'Bearer',
        token: req.user.accessToken
      },
      spreadsheetId: req.user.spreadsheet.spreadsheetId,
      worksheetId: req.user.spreadsheet.worksheetId,
      callback: function(err, spreadsheet) {
        req.user.workInfo.hours[req.body.type].value = req.body.value;
        var hoursCell = req.user.workInfo.hours[req.body.type];
        console.log('hours');
        console.log(hoursCell);

        var row = hoursCell.row;
        var column = hoursCell.column;

        var cellActionsRow = {};
        var cellActionsColumn = {};
        var cellActionsComplete = {};
        cellActionsColumn[hoursCell.column] = hoursCell.value;
        cellActionsRow[hoursCell.row] = cellActionsColumn;

        spreadsheet.add(cellActionsRow);
        spreadsheet.send(function(err) {
          res.json({'success' : true});
        });
      }
    });
  }
);

app.listen(config.port);
