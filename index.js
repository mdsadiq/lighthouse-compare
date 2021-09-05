const core = require("@actions/core");
const github = require("@actions/github");
const idx = require("idx");

const {
  getProjectID,
  getURLsToTest,
  getBaseBranchInfo,
  getPRBranchInfo,
  getReportData,
  prepareAndPostComment,
} = require("./utils");

// most @actions toolkit packages have async methods
async function run() {
  const githubToken = core.getInput("githubToken");
  const lhciServerURL = core.getInput("lhciServerURL");
  const baseBranch = core.getInput("baseBranch");

  if (!githubToken) {
    core.setFailed("Token to create PR Comment not provided");
  }
  // get id of commit to compare
  const currentCommitHash = github.context.payload.after;
  if (!currentCommitHash) {
    core.setFailed("unable to get current commit hash");
  }
  if (!lhciServerURL) {
    core.setFailed("Lighthouse Server URL not provided");
  }

  try {
    // get project details
    const projectListURL = `${lhciServerURL}/v1/projects`;
    const projectID = await getProjectID(core, projectListURL);
    
    /* Build Project URL using project id obtained from lhci server
    */
    const projectURL = `${lhciServerURL}/v1/projects/${projectID}`;


    const listURL = `${projectURL}/urls`;
    /* get all urls where lighthouse audit has run
    * list
    */
    const collectURLList = await getURLsToTest(core, listURL);

    //  prepare options for axios call
    const baseBranchOpts = {
      url: `${projectURL}/builds`,
      params: {
        branch: baseBranch,
        limit: 20
      }
    }
    const baseBranchInfo = await getBaseBranchInfo(core, baseBranchOpts);
    core.debug("baseBranchInfo obtained", baseBranchInfo);

    //  prepare options for axios call
    const prBranchOpts = {
      url: `${projectURL}/builds`,
      params: {
        limit: 20
      }
    }
    const PRBranchInfo = await getPRBranchInfo(core, prBranchOpts, currentCommitHash);
    core.debug("PRBranchInfo obtained", PRBranchInfo);

    // url to get light house report
    const lhciDataURL = `${projectURL}/builds/$$buildId$$/runs?representative=true`;

    /* get lighthouse reports for baseBranch and PRBranch
    */
    const lightHouseData = await getReportData(core,
      lhciDataURL,
      baseBranchInfo,
      PRBranchInfo,
      collectURLList
    );

    const prComment = await prepareAndPostComment(
      core,
      lightHouseData,
      github,
      githubToken
    );
    core.info("pr comment created at", idx(prComment, _ => _.created_at));
  } catch (error) {
    core.info('Lighthouse caught an error :' ,error)
    core.setFailed(error.message);
  }
}

run();
