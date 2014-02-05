var port = process.env.PORT || 3300;
module.exports = {
  port: port,
  google: { 
    CLIENT_ID: 'Your client id here',
    CLIENT_SECRET: 'Your client secret here',
    CALLBACK_URL: 'Your callback url here'
  },
  session: {
    SECRET: 'Your secret key here'
  },
  SPREADSHEET_KEY: 'Your spreadsheet key here'
}
