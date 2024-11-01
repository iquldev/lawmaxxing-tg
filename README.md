# Lawmaxxing

A self-hosted web application that demonstrates speed monitoring capabilities using maps. This is a proof-of-concept project meant for **educational purposes only**.

<img src="https://github.com/user-attachments/assets/941248d2-ace0-4b61-9dd8-cbdf130b4d78" width="30%">

## Legal Disclaimer

THIS SOFTWARE IS PROVIDED FOR EDUCATIONAL AND ENTERTAINMENT PURPOSES ONLY.

- This application is not intended to be used as a law enforcement tool or legitimate speed monitoring system
- Any SMS messages sent by this application are purely demonstrative
- The creators and contributors assume no liability for any misuse of this software
- This is not a substitute for actual law enforcement or emergency services
- If you witness actual traffic violations or emergencies, contact your local authorities through appropriate channels

## Setup

1. Prerequisites:
   - [Node.js](https://nodejs.org/en)
   - A [Mapbox](https://www.mapbox.com/) account for map functionality
   - A [Twilio](https://www.twilio.com/en-us) account for SMS capabilities

2. Environment Variables:
   Create a `.env` file in the root directory with the following:
   ```python
   RECEIVER_PHONE_NUMBER=your_phone_number
   TWILIO_PHONE_NUMBER=your_twilio_number
   TWILIO_ACCOUNT_SID=your_twilio_sid
   TWILIO_AUTH_TOKEN=your_twilio_token
   ```

3. Mapbox Configuration:
   - Obtain a Mapbox access token from [Mapbox](https://www.mapbox.com/)
   - Replace `REPLACE_ME__BUDDY` in `src/routes/+page.svelte` with your Mapbox token

4. And we're almost done!
   ```bash
   npm install
   npm run dev
   ```
5. If you want to use it on your 📱 phone:
    - Easiest way would be to host it on [Vercel](https://vercel.com) (**NOT AFFILIATED**).
    - then open the site on your phone (i.e. `https://gpeaoihganebo.vercel.app`).

## Configuration details
- `RECEIVER_PHONE_NUMBER`: The phone number that will receive SMS notifications. Make sure it starts with the receiver's country code, i.e. `+1xxxxx` for the US.
- `TWILIO_PHONE_NUMBER`: Your Twilio-provided phone number for sending SMS.
- `TWILIO_ACCOUNT_SID`: Your Twilio account SID.
- `TWILIO_AUTH_TOKEN`: Your Twilio authentication token.

## Contributing
This is an educational project that has reached a stable state. While you're welcome to fork and modify the codebase for your own learning purposes, please note that this repository is in maintenance mode. New feature requests or pull requests are unlikely to be reviewed or merged, as the project is intended to remain in its current form.

## License
Apache 2.0

---
Remember: This is a demonstration project. Always follow local laws and regulations regarding traffic monitoring and reporting.

Developed by [FaceDev](https://youtube.com/c/FaceDevStuff).
