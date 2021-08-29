
const process = require('process');
const cp = require('child_process');
const path = require('path');
const MockAdapter = require('axios-mock-adapter');
const axios = require('axios');
const mock = new MockAdapter(axios);
const mockResponse = require('./mock');
const { getProjectID } = require('../utils');

mock.onGet("/users").reply(200, mockResponse.projectInfo);

test('get project id', async () => {
  let url = '/users';
  await expect(getProjectID(url)).resolves.toEqual(mockResponse.projectId)
})


// shows how the runner will run a javascript action with env / stdout protocol
// test('test runs', () => {
//   process.env['INPUT_MILLISECONDS'] = 500;
//   const ip = path.join(__dirname, 'index.js');
//   console.log(cp.execSync(`node ${ip}`, {env: process.env}).toString());
// })
