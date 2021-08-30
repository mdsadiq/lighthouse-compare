const core = require('@actions/core');
const github = require('@actions/github');
const { getProjectID, getURLsToTest, getBaseBranchInfo, getPRBranchInfo, getReportData, postResultsToPullRequest } = require('./utils');

const context = github.context;

// most @actions toolkit packages have async methods
async function run() {
  const githubToken = core.getInput('githubToken');
  const lhciAppURL = core.getInput('lhciServerURL');
  // const lhciAppURL = 'https://glacial-eyrie-43671.herokuapp.com'
  if(!githubToken){
    console.log('token not passed, will not be able to create PR comment with the results');
    core.setFailed('Token to create PR Comment not provided');
  }
  // const octokit = github.getOctokit(githubToken);

  // if (!secret) {
  //   core.setFailed('secret not defined');
  //   core.warning('');
  // }
  if(!lhciAppURL){
    core.setFailed('Lighthouse Server URL not provided');
  }

  // const myToken = core.getInput("token", { required: true });

  try {
    core.info((new Date()).toTimeString()); // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true
    
    // get project details
    const projectURL = `${lhciAppURL}/v1/projects`;
    let projectID = await getProjectID(projectURL, core);
    console.log('Project ID identified : ', projectID)

    // get all urls where lhci have to be tested
    const listURL = `${lhciAppURL}/v1/projects/${projectID}/urls`
    console.log('listURL',listURL)
    const collectURLList = await getURLsToTest(listURL);
    // const collectURLList = [ { "url": "http://localhost:PORT/" } ];
    console.log('collectURLList', collectURLList)
    // find base build id
    const masterBranchName = 'master'; // main in new repos
    const baseBranchBuildURL = `${lhciAppURL}/v1/projects/${projectID}/builds?branch=${masterBranchName}&limit=20`;

    /*
    *   get branch information about base branch (ideally master or main)
    *   returns {Object}
    */
    const baseBranchInfo = await getBaseBranchInfo(baseBranchBuildURL);
    
    // get id of commit to compare
    const currentCommitHash = github.context.payload.after;    
    const PRBranchURL = `${lhciAppURL}/v1/projects/${projectID}/builds?limit=30`;
    console.log('PRBranchURL', PRBranchURL, currentCommitHash)
    if(!currentCommitHash){
      console.log('unable to get current commit hash');
    }
    const PRBranchInfo = await getPRBranchInfo(PRBranchURL, currentCommitHash);
    console.log('PRBranchInfo obtained', PRBranchInfo)
    // get report for each branch
    const lhciDataURL =`${projectURL}/${projectID}/builds/$$buildId$$/runs?representative=true`
    
    console.log('lhciDataURL', lhciDataURL);
    // get lighthouse reports for baseBranch and PRBranch
    const collectLightHouseData = await getReportData(lhciDataURL, baseBranchInfo, PRBranchInfo, collectURLList);
    core.startGroup('collectLightHouseData');
    console.log('collectLightHouseData', collectLightHouseData, collectLightHouseData.length)
    core.endGroup();

    const prComment = await postResultsToPullRequest(core, collectLightHouseData, github, githubToken)
    core.info((new Date()).toTimeString());
    console.log('prComment',prComment);
    // core.setOutput('time', new Date().toTimeString());
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
