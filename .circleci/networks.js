const testnetFailed = parseInt(process.argv[2]) > 0;
const devnetFailed = parseInt(process.argv[3]) > 0;

const x = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Darknode networks" time="0" tests="2" failures="${testnetFailed + devnetFailed}">
  <testsuite name="Testnet" tests="1" failures="${testnetFailed ? "1" : "0"}" time="0">
    <testcase name="Testnet" time="0" classname="Testnet">
        ${testnetFailed ? `<failure message="Testnet failed!"></failure>` : ""}
    </testcase>
  </testsuite>
  <testsuite name="Devnet" tests="1" failures="${devnetFailed ? "1" : "0"}" time="0">
    <testcase name="Devnet" time="0" classname="Devnet">
        ${devnetFailed ? `<failure message="Devnet failed!"></failure>` : ""}
    </testcase>
  </testsuite>
</testsuites>`;

console.log(x);