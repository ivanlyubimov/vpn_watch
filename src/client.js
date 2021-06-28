import { createRequire } from 'module'
import { exec } from 'child_process'
import express from 'express'
const require = createRequire(import.meta.url)
const ifconfig = require('ifconfig')

import { networkMessage, en } from './utils.js'

class Client {
  constructor(config) {
    this.config = config
    this.state = { vpnStatus: null }
    this.interval = null
  }

  async start(std) {
    this.interval = setInterval(async () => {
      const current = this.state.vpnStatus
      const { err: uvsErr, data: updatedVpnStatus } = await en(this.updateVpnStatus())
      if (uvsErr) return std(uvsErr)

      if (updatedVpnStatus === current) return
      std(null, `vpn is ${updatedVpnStatus}`)
      const switchedOn = updatedVpnStatus === 'enabled'
      const switchedOff = updatedVpnStatus === 'disabled'

      const { err: secureErr, data: secureData } = await en(switchedOn ? this.secureUp() : this.secureDown())
      std(secureErr, secureData)

      if (switchedOff) {
        const { err, data } = await en(networkMessage(`vpn is off at ${this.config.deviceName}`))
        std(err, data)
      }
    }, this.config.interval * 1000)

    this.startServer(this.config.serverPort)
  }

  async updateVpnStatus() {
    const { data: updatedVpnStatus, err  } = await en(this.isVpnActive())
    if (err) return err
    return (await this.setState({ vpnStatus: updatedVpnStatus })).vpnStatus
  }

  async setState(newState, cb) {
    this.state = { ...this.state, ...newState }
    if (cb) return cb()
    return this.state
  }

  async isVpnActive() {
    return new Promise((resolve, reject) => {
      ifconfig((err, configs) => {
        if (err) return reject(err)
        return resolve(configs.map(c => c.name).includes('ipsec') ? 'enabled' : 'disabled')
      })
    })
  }

  async isTaskRunning(label) {
    return new Promise((resolve, reject) => {
      exec(`ps axo pid,command | grep "${label}"`, (err, stdout) => {
        if (err) return reject(err)
        return resolve(stdout.includes(`/${label}`))
      })
    })
  }

  async killTask(task) {
    return new Promise((resolve, reject) => {
      exec(`pkill -f ${task.label}`, (err) => {
        if (err) return reject(err)
        const result = `killed ${task.label}`
        return resolve(result)
      })
    })
  }

  async startTask(task) {
    return new Promise((resolve, reject) => {
      exec(task.command, (err) => {
        if (err) return reject(err)
        const result = `started ${task.label}`
        return resolve(result)
      })
    })
  }

  async secureDown() {
    const { tasks = [] } = this.config
    const running = (await Promise.all(tasks.map(async (task) => {
      if (await this.isTaskRunning(task.label)) return task
    }))).filter(p => p)
  
    if (running.length) return await Promise.all(running.map(active => this.killTask(active)))
    return 'nothing to kill'
  }

  async secureUp() {
    const { tasks = [] } = this.config
    const idle = (await Promise.all(tasks.map(async (task) => {
      if (!(await this.isTaskRunning(task.label))) return task
    }))).filter(p => p)
  
    if (idle.length) return await Promise.all(idle.map(inactive => this.startTask(inactive)))
    return 'nothing to start'
  }

  async startServer(port) {
    const app = express()
    app.get('/', async (req, res) => res.send(`
      vpn is currently ${this.state.vpnStatus} at ${this.config.deviceName}
    `))
    app.listen(port)
  }
}

export default Client