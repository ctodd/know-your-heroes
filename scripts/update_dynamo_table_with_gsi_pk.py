import boto3
from botocore.exceptions import ClientError
import argparse

def update_all_items(profile_name, region_name, table_name):
    # Create a session using the specified profile
    session = boto3.Session(profile_name=profile_name)

    # Initialize the DynamoDB resource with the session and region
    dynamodb = session.resource('dynamodb', region_name=region_name)
    table = dynamodb.Table(table_name)

    scan_kwargs = {
        'TableName': table.name,
    }
    items = []
    done = False
    start_key = None

    while not done:
        if start_key:
            scan_kwargs['ExclusiveStartKey'] = start_key
        response = table.scan(**scan_kwargs)
        items.extend(response.get('Items', []))
        start_key = response.get('LastEvaluatedKey', None)
        done = start_key is None

    print(f"Found {len(items)} items to update.")

    batch_size = 25  # DynamoDB allows max 25 items per batch write
    for i in range(0, len(items), batch_size):
        batch = items[i:i+batch_size]
        try:
            with table.batch_writer() as batch_writer:
                for item in batch:
                    item['scorePartition'] = 'SCORE'  # Add the GSI partition key
                    batch_writer.put_item(Item=item)
            print(f"Updated items {i+1} to {min(i+batch_size, len(items))}")
        except ClientError as e:
            print(f"Error updating batch: {e}")

    print("Finished updating all items.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Update DynamoDB items with GSI partition key")
    parser.add_argument("--profile", required=True, help="AWS profile name")
    parser.add_argument("--region", required=True, help="AWS region name")
    parser.add_argument("--table", required=True, help="DynamoDB table name")
    args = parser.parse_args()

    update_all_items(args.profile, args.region, args.table)