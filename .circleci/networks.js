const x = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Darknode networks" time="0" tests="2" failures="1">
  <testsuite name="Testnet" tests="1" failures="0" time="0">
    <testcase name="Testnet" time="0" classname="Testnet">
  </testsuite>
  <testsuite name="Devnet" tests="1" failures="1" time="0">
    <testcase name="Devnet" time="0" classname="Devnet">
        <failure message="Devnet failed!"></failure>
    </testcase>
  </testsuite>
</testsuites>`;

console.log(x);