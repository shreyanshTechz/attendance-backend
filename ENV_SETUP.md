# Environment Variables Setup

## Required Environment Variables

Create a `.env` file in the backend directory with the following variables:

```env
# Office Location Configuration
OFFICE_LATITUDE=26.7428378
OFFICE_LONGITUDE=83.3797713
OFFICE_RADIUS_KM=0.2

# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
REACT_APP_MONGO_URI=your_mongodb_connection_string

# JWT Secret
REACT_APP_JWT_SECRET=your_jwt_secret_key

# Google OAuth (if using)
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
```

## Office Location Configuration

- **OFFICE_LATITUDE**: Latitude of your office location (decimal degrees)
- **OFFICE_LONGITUDE**: Longitude of your office location (decimal degrees)  
- **OFFICE_RADIUS_KM**: Radius in kilometers within which attendance is considered valid

## Example Values

```env
# Example: Office in Gorakhpur, India
OFFICE_LATITUDE=26.7428378
OFFICE_LONGITUDE=83.3797713
OFFICE_RADIUS_KM=0.2

# Example: Office in New York, USA
OFFICE_LATITUDE=40.7128
OFFICE_LONGITUDE=-74.0060
OFFICE_RADIUS_KM=0.5
```

## How to Update Office Location

1. Update the values in your `.env` file
2. Restart the backend server
3. The frontend will automatically fetch the new configuration

## Security Notes

- Never commit the `.env` file to version control
- Keep your JWT secret secure and unique
- Use strong, unique values for production environments 