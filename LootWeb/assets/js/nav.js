const urlParams = new URLSearchParams(window.location.search);
const subscriberID = urlParams.get('subscriberID');

const goToExAccounts = () => window.location.assign(`ExAccounts.html?subscriberID=${subscriberID}`);
const goToTransfer   = () => window.location.assign(`MT-Dashboard.html?subscriberID=${subscriberID}`);
const goToBudget     = () => window.location.assign(`budget.html?subscriberID=${subscriberID}`);
const goToFamily     = () => window.location.assign(`Fam-dash.html?subscriberID=${subscriberID}`);
const goToSummary    = () => window.location.assign(`sum_dashboard.html?subscriberID=${subscriberID}`);
const goToDashboard  = () => window.location.assign(`Dashboard.html?subscriberID=${subscriberID}`);