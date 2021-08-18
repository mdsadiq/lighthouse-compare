const core = require('@actions/core');
const github = require('@actions/github');
const { getProjectID, getURLsToTest, getBaseBranchInfo, getPRBranchInfo, getReportData, postResultsToPullRequest } = require('./utils');

const context = github.context;

// most @actions toolkit packages have async methods
async function run() {
  // const secret = core.getInput('secret');
  const lhciAppURL = core.getInput('lhciServerURL');
  // const lhciAppURL = 'https://glacial-eyrie-43671.herokuapp.com'
  // if (!secret) {
  //   core.setFailed('secret not defined');
  //   core.warning('');
  // }
  if(!lhciAppURL){
    core.setFailed('Lighthouse Server URL not provided');
  }

  // const myToken = core.getInput("token", { required: true });

  try {
    const ms = core.getInput('milliseconds');
    core.info(`Waiting ${ms} milliseconds ...`);

    core.debug((new Date()).toTimeString()); // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true
    // await wait(parseInt(ms));
    
    // get project details
    // const lhciAppURL = 'https://glacial-eyrie-43671.herokuapp.com';

    const projectURL = `${lhciAppURL}/v1/projects`;
    let projectID = await getProjectID(projectURL, core);
    console.log('Project ID identified : ', projectID)

    // get all urls where lhci have to be tested
    // const listURL = `${lhciAppURL}/v1/projects/${projectID}/urls`
    // const collectURLList = await getURLsToTest(listURL);
    const collectURLList = [ { "url": "http://localhost:PORT/" } ];

    // find base build id
    const masterBranchName = 'master'; // main in new repos
    const baseBranchBuildURL = `${lhciAppURL}/v1/projects/${projectID}/builds?branch=${masterBranchName}&limit=20`;
    console.log('baseBranchBuildURL', baseBranchBuildURL)
    /*
    *   get branch information about base branch (ideally master or main)
    *   returns {Object}
    */
    const baseBranchInfo = await getBaseBranchInfo(baseBranchBuildURL);
    console.log('baseBranchInfo obtained', baseBranchInfo)
    
    // get id of commit to compare
    console.log('github context', typeof github.context.payload);
    console.log('github context', typeof github.context.payload.after);
    console.log('github context', github.context.payload.after);
    console.log('github context', context.payload.after);
    // console.log('github context pr', context.payload.pull_request.number);
    const currentCommitHash = github.context.payload.after;    
    const PRBranchURL = `${lhciAppURL}/v1/projects/${projectID}/builds?limit=30`;
    console.log('PRBranchURL', PRBranchURL, currentCommitHash)
    if(!currentCommitHash){
      console.log('unable to get current commit hash');
    }
    const PRBranchInfo = await getPRBranchInfo(PRBranchURL, currentCommitHash);
    console.log('PRBranchInfo obtained', PRBranchInfo)
    // get report for each branch
    const lhciDataURL =`${projectURL}/${projectID}/builds/$$buildId$$/runs?representative=true}`
    
    console.log('lhciDataURL', lhciDataURL);
    // get lighthouse reports for baseBranch and PRBranch
    const collectLightHouseData = await getReportData(lhciDataURL, baseBranchInfo, PRBranchInfo, collectURLList);

    console.log('collectLightHouseData', collectLightHouseData)


    const prComment = await postResultsToPullRequest(core, collectLightHouseData, github)
    core.info((new Date()).toTimeString());
    core.info(prComment);
    // core.setOutput('time', new Date().toTimeString());
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
