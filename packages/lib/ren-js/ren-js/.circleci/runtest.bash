yarn run test --reporter mocha-multi-reporters --reporter-options configFile=.circleci/mocha.json
test_exit_code=$?
echo "$test_exit_code" > devnet
exit "$test_exit_code"
