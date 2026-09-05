#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
const { PondNeckStack } = require('../lib/pondneck-stack');

const app = new cdk.App();

// The account/region are pinned rather than read from the ambient profile, so this
// app can never be synthesised against somewhere unintended.
new PondNeckStack(app, 'PondNeckStack', {
  env: { account: '515452441415', region: 'us-east-1' },
  description: 'Pond Neck Olympics: shared scorekeeping backend (DynamoDB + Lambda + HTTP API)',
});

// Everything this app owns is tagged, so it is trivially separable from FestivusStack /
// kindredreels / loomed-memories / WhereIRun resources living in the same account.
cdk.Tags.of(app).add('project', 'pondneck');
