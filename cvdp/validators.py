import django
from django.core.validators import BaseValidator
import jsonschema
import json
import traceback

CSAF_SCHEMA_FILE = "cvdp/schemas/csaf_json_schema.json";

class JSONSchemaValidator(BaseValidator):
    def compare(self, value, schema):
        try:
            jsonschema.validate(value, schema)
        except jsonschema.exceptions.ValidationError:
            raise django.core.exceptions.ValidationError(
                '%(value)s failed JSON schema check', params={'value': value}
            )

        

def validate_csaf(csaf):

    try:
        value = json.loads(csaf);
    except:
        print(traceback.format_exc())
        print(f"Error: CSAF has invalid JSON format")
        return False

    
    try:
        with open(CSAF_SCHEMA_FILE, 'r') as schema_file:
            schema = json.load(schema_file)
    except FileNotFoundError:
        print(f"Error: Schema file not found at '{CSAF_SCHEMA_FILE}'")
        return False
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON format in '{CSAF_SCHEMA_FILE}'")
        return False

    try:
        
        jsonschema.validate(instance=value, schema=schema)
        print("Validation successful! JSON file is valid against the schema.")
        return True
    except jsonschema.exceptions.ValidationError as e:
         print(f"Validation failed: {e.message}")
         return False
