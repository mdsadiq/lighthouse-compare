const axios = require('axios');

/**
 * Gets Project Id from the lighthouse server
 * @function
 * @param {string} url - URL to send request.
 * @return {string} project id
 */
const getProjectID = async function(url, core) {
  return await axios.get(url).then(function (response) {
    return response.data[0].id
  }).catch(function (error) {
    // handle error
    core.info('github payload error', error);
    console.log(error, 'error fetching project id');
  })
};

/**
 * Gets all the URLs on which Lighthouse was conducted
 * @function
 * @param {string} url - URL to send request.
 * @return {Object} 
 */
const getURLsToTest = async function(url){
  return await axios.get(url).then(function (response) {
    return response.data
  }).catch(function (error) {
    // handle error
    console.log(error, 'error fetching urls to test');
  })
};

/**
 * Gets Information about base branch
 * @function
 * @param {string} url - URL to send request.
 * @return {Object} 
 */
const getBaseBranchInfo = async function getBaseBranchInfo(url){
  return await axios.get(url).then(function (response) {
    console.log('getBaseBranchInfo', response.data);
    if(response.data.length > 0) return response.data[0];
    throw new Error('No build available from base branch');
  }).catch(function (error) {
    // handle error
    console.log(error, 'error fetching Base branch info');
  })
}

/**
 * Gets Information about branch from which pull request is created
 * @function
 * @param {string} url - URL to send request.
 * @param {string} commitHash - hash of the commit from which lh report was generated.
 * @return {Object} 
 */
const getPRBranchInfo = async function getPRBranchInfo(url, commitHash) {
  return await axios.get(url).then(function (response) {
    console.log('getPRBranchInfo', response.data);
    const transformed = response.data.map(d => ({ 
      id: d.id,
      commitId: d.commitMessage.split(' ')[1]
    }));
    const selectedBuild = transformed.find(build => build.commitId === commitHash)
    console.log('selectedBuild', selectedBuild)
    return selectedBuild ? selectedBuild.id : null;
  }).catch(function (error) {
    // handle error
    console.log(error, 'error fetching PR branch info');
  })
}

/**
 * Gets lighthouse report for base and pull request
 * @function
 * @param {string} projectURL - URL to send request.
 * @param {Object} baseBranchInfo - information about the base branch.
 * @param {Object} PRBranchInfo - information about the pull request.
 * @param {Array} collectURLList - List of urls.
 * @return {Array} - Array of lh reports 
 */
const getReportData = async function(projectURL, baseBranchInfo, PRBranchInfo, collectURLList) {
  const baseURL = projectURL.replace('$$buildId$$', baseBranchInfo.id);
  const prURL = projectURL.replace('$$buildId$$', PRBranchInfo.id);
  const baseAxios = axios.get(baseURL);
  const PRAxios = axios.get(prURL);
  return await axios.all([ baseAxios, PRAxios ]).then(axios.spread((...responses) => {
    const responseOne = responses[0]
    const responseTwo = responses[1]
    const baseLHRData = JSON.parse(responseOne.data.lhr);
    const prLHRData = JSON.parse(responseTwo.data.lhr);
    
    return [ baseLHRData, prLHRData ];

  })).catch(function (error) {
    // handle error
    console.log(error, 'getReportData error');
  })

}

function _generateLogString(
  rows,
  timings
) {
    return `
  [Lighthouse](https://developers.google.com/web/tools/lighthouse/) report for the changes in this PR:
  | Category | Base Branch (score) | PR (score) |
  | ------------- | ------------- | ------------- |
  ${rows}
  | Measure | Base Branch (timing) | PR (timing) |
  | ------------- | ------------- | ------------- |
  ${timings}`
}
const parseLighthouseResultsToString = function parseLighthouseResultsToString(core, lhr) {
  let rows = '';
  let timings = '';

  Object.values(lhr[0].categories).forEach(cat => {
    rows += `| ${cat.title} | ${cat.score * 100} | ${lhr[1].categories[cat].score * 100} | \n`;
  });

  [
    'first-contentful-paint',
    'interactive',
    'first-meaningful-paint',
    'max-potential-fid',
    'total-blocking-time',
    'speed-index',
    'largest-contentful-paint',
    'cumulative-layout-shift',
  ].forEach(cat => {
    if (lhr[0].audits[cat]) {
      timings += `| ${lhr[0].audits[cat].title} | ${lhr[0].audits[cat].displayValue} | ${lhr[1].audits[cat].displayValue} | \n`;
    }
  });
  return _generateLogString(
    rows,
    timings,
  );
}

/**
 * compare two lighthouse report data and make comment the results in table
 * @function
 * @param {Object} core - github actions core 
 * @param {Array} lhr - light house report data of two branches, base and new
 * @param {Object} github - github context.
 * @param {string} secret - github token that has permission to add comment.
 * @return {Object} 
 */
const postResultsToPullRequest = async function postResultsToPullRequest(core, lhr, github, secret) {
  const string = parseLighthouseResultsToString(lhr);
  core.info('github payload', github.context.payload);
  if (
    github.context.payload.pull_request &&
    github.context.payload.pull_request.comments_url &&
    secret
  ) {
    const postComment = await axios(github.context.payload.pull_request.comments_url, {
      method: 'post',
      body: JSON.stringify({
        body: string,
      }),
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${github.token}`,
      },
    });
    return postComment
  } else {
    core.info('Missing pull request info or comments_url in contexts or secret');
    core.info(github.context.payload);
  }
}

module.exports = {
  getProjectID,
  getURLsToTest,
  getBaseBranchInfo,
  postResultsToPullRequest,
  getReportData,
  getPRBranchInfo
};
