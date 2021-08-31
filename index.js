const core = require("@actions/core");
const github = require("@actions/github");
const idx = require("idx");

const {
  getProjectID,
  getURLsToTest,
  getBaseBranchInfo,
  getPRBranchInfo,
  getReportData,
  postResultsToPullRequest,
} = require("./utils");

// most @actions toolkit packages have async methods
async function run() {
  const githubToken = core.getInput("githubToken");
  const lhciAppURL = core.getInput("lhciServerURL");
  const baseBranch = core.getInput("baseBranch");

  if (!githubToken) {
    core.setFailed("Token to create PR Comment not provided");
  }
  // get id of commit to compare
  const currentCommitHash = github.context.payload.after;
  if (!currentCommitHash) {
    core.setFailed("unable to get current commit hash");
  }
  if (!lhciAppURL) {
    core.setFailed("Lighthouse Server URL not provided");
  }

  try {
    // get project details
    const projectURL = `${lhciAppURL}/v1/projects`;
    let projectID = await getProjectID(projectURL, core);
    console.log("Project ID identified : ", projectID);

    // get all urls where lhci have to be tested
    const listURL = `${lhciAppURL}/v1/projects/${projectID}/urls`;
    const collectURLList = await getURLsToTest(listURL);
    
    // find base build id
    const masterBranchName = baseBranch || "master"; // main in new repos
    const baseBranchBuildURL = `${lhciAppURL}/v1/projects/${projectID}/builds?branch=${masterBranchName}&limit=20`;

    /*
     *   get branch information about base branch (ideally master or main)
     *   returns {Object}
     */
    const baseBranchInfo = await getBaseBranchInfo(baseBranchBuildURL);

    const PRBranchURL = `${lhciAppURL}/v1/projects/${projectID}/builds?limit=30`;

    const PRBranchInfo = await getPRBranchInfo(PRBranchURL, currentCommitHash);
    console.debug("PRBranchInfo obtained", PRBranchInfo);
    // get report for each branch
    const lhciDataURL = `${projectURL}/${projectID}/builds/$$buildId$$/runs?representative=true`;

    core.debug("lhciDataURL", lhciDataURL);
    // get lighthouse reports for baseBranch and PRBranch
    const lightHouseData = await getReportData(
      lhciDataURL,
      baseBranchInfo,
      PRBranchInfo,
      collectURLList
    );

    const prComment = await postResultsToPullRequest(
      core,
      lightHouseData,
      github,
      githubToken
    );
    console.log("pr comment created at", idx(prComment, _ => _.created_at));
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
