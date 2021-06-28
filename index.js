import client from './src/client.js'
import config from './config.js'
import { errReport, log } from './src/utils.js'

const vpnChecker = new client(config)
vpnChecker.start(function (err, data) {
  if (err) return errReport.call(this, err)
  if (data) return log.call(this, data)
}.bind(process))