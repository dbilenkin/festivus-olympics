const {
  Stack, Duration, RemovalPolicy, CfnOutput,
} = require('aws-cdk-lib');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const lambda = require('aws-cdk-lib/aws-lambda');
const logs = require('aws-cdk-lib/aws-logs');
const iam = require('aws-cdk-lib/aws-iam');
const apigw = require('aws-cdk-lib/aws-apigatewayv2');
const integrations = require('aws-cdk-lib/aws-apigatewayv2-integrations');
const budgets = require('aws-cdk-lib/aws-budgets');
const path = require('path');

/**
 * Pond Neck Olympics backend.
 *
 * Everything is namespaced `pondneck-*` in its own CloudFormation stack. It shares no
 * resources with FestivusStack (which lives in a different CDK app, in a sibling repo)
 * or anything else in this account.
 *
 *   DynamoDB  pondneck-events    one partition per event, one item per "fact"
 *   Lambda    pondneck-api       the whole API, no npm deps
 *   HTTP API  pondneck-http-api  public, throttled per route
 *
 * The data model is a map of independently-addressed last-write-wins registers, so two
 * phones timing different stations never collide, and two phones editing the SAME field
 * converge on the later write regardless of the order the writes arrive in.
 *
 * Writes are wide open by design. Abuse is bounded by cost controls, not by auth:
 * per-route throttling, reserved concurrency, DynamoDB throughput caps, and a budget alarm.
 */
class PondNeckStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // ---------------------------------------------------------------- storage
    // RETAIN + deletion protection + PITR. Results are meant to outlive the stack;
    // `cdk destroy` must never be able to take the scores with it.
    const table = new dynamodb.TableV2(this, 'Table', {
      tableName: 'pondneck-events',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand({
        // Hard ceiling on spend even if the public write endpoint is discovered.
        maxReadRequestUnits: 500,
        maxWriteRequestUnits: 100,
      }),
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // -------------------------------------------------------------------- api
    const apiLogs = new logs.LogGroup(this, 'ApiLogs', {
      logGroupName: '/aws/lambda/pondneck-api',
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY, // logs are fine to lose
    });

    const api = new lambda.Function(this, 'ApiFunction', {
      functionName: 'pondneck-api',
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'api')),
      memorySize: 256,
      timeout: Duration.seconds(10),
      // The cost circuit breaker. Bounds Lambda spend AND the load DynamoDB can ever see.
      reservedConcurrentExecutions: 5,
      logGroup: apiLogs,
      environment: { TABLE_NAME: table.tableName },
    });

    // Least privilege, written out by hand. grantReadWriteData() would also hand over
    // Scan, DeleteItem and BatchWriteItem — this model tombstones and never deletes, so
    // DeleteItem should not exist as a capability at all.
    api.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:Query',
      ],
      resources: [table.tableArn],
    }));

    // CORS is configured HERE and ONLY here. If the Lambda also emitted
    // Access-Control-Allow-Origin the browser would see a duplicated header and fail the
    // request with a misleading error.
    const httpApi = new apigw.HttpApi(this, 'HttpApi', {
      apiName: 'pondneck-http-api',
      description: 'Pond Neck Olympics public API',
      corsPreflight: {
        allowOrigins: [
          'https://dbilenkin.github.io',
          'http://localhost:5173',
          'http://localhost:4173',
        ],
        allowMethods: [
          apigw.CorsHttpMethod.GET,
          apigw.CorsHttpMethod.POST,
          apigw.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['content-type'],
        maxAge: Duration.hours(1),
      },
    });

    const integration = new integrations.HttpLambdaIntegration('ApiIntegration', api);
    // GET/POST only, deliberately NOT ANY. HttpMethod.ANY would capture OPTIONS and send
    // preflight to the Lambda, which answers 404 -- and a browser treats a non-2xx
    // preflight as a CORS failure, breaking every write from the real client. Leaving
    // OPTIONS unrouted lets the API's own corsPreflight answer it with a 204.
    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigw.HttpMethod.GET, apigw.HttpMethod.POST],
      integration,
    });

    // Throttling happens BEFORE Lambda is invoked. This is the reason for choosing an
    // HTTP API over a Function URL, which has no rate limiting at all.
    const stage = httpApi.defaultStage.node.defaultChild;
    stage.defaultRouteSettings = { throttlingRateLimit: 20, throttlingBurstLimit: 40 };

    // ------------------------------------------------------------------ spend
    new budgets.CfnBudget(this, 'Budget', {
      budget: {
        budgetName: 'pondneck-monthly',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: 5, unit: 'USD' },
        costFilters: { TagKeyValue: ['user:project$pondneck'] },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 80,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [{ subscriptionType: 'EMAIL', address: 'dbilenkin@gmail.com' }],
        },
      ],
    });

    new CfnOutput(this, 'ApiBaseUrl', { value: httpApi.apiEndpoint });
    new CfnOutput(this, 'TableName', { value: table.tableName });
  }
}

module.exports = { PondNeckStack };
