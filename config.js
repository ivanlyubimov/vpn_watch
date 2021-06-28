const config = {
  interval: 1,
  tasks: [
    {
      label: 'Transmission',
      command: 'open -a Transmission'
    }
  ],
  telegram: {
    chatId: '',
    token: ''
  },
  deviceName: '.104',
  moduleName: 'Simple Vpn Checker',
  serverPort: '9999'
}

export default config