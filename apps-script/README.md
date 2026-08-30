# WIAN enquiry acknowledgement email

This folder contains a Phase 2 helper for the existing WIAN Google Apps Script enquiry backend. It adds a plain-text acknowledgement email after the original enquiry has already been processed successfully for WIAN.

The repository does not contain the production Apps Script source. This helper is deliberately additive: it does not define or replace `doPost(e)`, change the public endpoint, store credentials, or resubmit an enquiry.

## 1. Code being added

Copy `enquiry-acknowledgement.gs` into the existing Apps Script project as a new script file. The helper:

- validates the submitted customer email before attempting delivery;
- sanitises the customer name, vehicle and service values before placing them in the message;
- creates natural reference wording when vehicle or service is absent;
- sends through Apps Script's built-in `MailApp` service;
- sets the sender display name to `WIAN Auto Parts`;
- sets replies to `winston.kennedy@wianautoparts.com`; and
- catches and safely logs mail failures without exposing customer details or throwing back into the enquiry workflow.

`MailApp` sends from the Google account that authorises and executes the Apps Script. The `name` option changes only the sender display name.

## 2. Exact integration point inside the existing `doPost(e)`

Use the same parsed enquiry object that already contains `email`, `name`, `phone`, `vehicle`, `service` and `message`.

Call the helper exactly once, immediately after every existing step that successfully delivers or records the enquiry for WIAN, and immediately before the existing success response is returned:

```javascript
// Existing parsing and validation remain unchanged.
var enquiry = {
  email: data.email,
  name: data.name,
  phone: data.phone,
  vehicle: data.vehicle,
  service: data.service,
  message: data.message
};

// Existing WIAN enquiry processing must complete successfully above this line.
// For example: the existing notification, storage or forwarding logic.

sendWianEnquiryAcknowledgement_(enquiry);

// Return the existing successful doPost(e) response unchanged below this line.
```

This is an integration fragment, not a replacement `doPost(e)`. Do not call the helper before WIAN's existing processing succeeds, inside a retry loop, or from an error handler. The helper catches its own mail error, so a failed acknowledgement cannot fail or duplicate the original enquiry.

## 3. Deploy or redeploy safely

1. Open the production Apps Script project while signed in to the intended WIAN Google Workspace account.
2. Save a copy or record the currently deployed version before editing.
3. Add a new script file and paste in `enquiry-acknowledgement.gs`.
4. Add the single helper call at the integration point described above. Do not replace the existing `doPost(e)`.
5. Save the project and complete the controlled tests below before changing the production deployment.
6. In Apps Script, choose **Deploy → Manage deployments**.
7. Select the existing WIAN web-app deployment and choose **Edit**.
8. Select **New version**, add a clear description, and deploy that version.
9. Keep the existing deployment and URL. Confirm the production website endpoint has not changed.
10. If rollback is required, edit the same deployment and point it back to the previous known-good version.

Official references:

- [MailApp reference](https://developers.google.com/apps-script/reference/mail/mail-app)
- [Apps Script web apps](https://developers.google.com/apps-script/guides/web)
- [Apps Script deployments and versions](https://developers.google.com/apps-script/concepts/deployments)

## 4. Google permission to authorise

`MailApp.sendEmail` requires the Apps Script OAuth scope:

```text
https://www.googleapis.com/auth/script.send_mail
```

Run the controlled test function once while signed in to the intended WIAN Google Workspace account and approve the mail-sending permission when prompted. No Gmail password, SMTP credential, OAuth secret, API key or access token belongs in the source code or repository.

## 5. Safe testing procedure

Test the helper without touching the live website or production deployment:

1. Make a temporary copy of the Apps Script project, or add the helper to the saved but not yet redeployed production project.
2. Add the temporary test function below only in the Apps Script editor. Use a controlled WIAN-owned test inbox, never a customer address.
3. Run it manually once and authorise `MailApp` when prompted.
4. Confirm the subject, body, sender display name and Reply-To header in the received message.
5. Repeat with empty `vehicle`, then empty `service`, to verify the fallback wording.
6. Repeat with an invalid email and confirm that no email is sent and the execution log contains only the generic skip message.
7. Remove the temporary test function.
8. Review the real `doPost(e)` integration to confirm the helper is called exactly once and only after the original WIAN processing succeeds.
9. Use **Deploy → Test deployments** for one synthetic end-to-end enquiry if the existing backend has a safe non-production destination. Do not point the public website at the `/dev` URL.
10. Only after those checks pass, update the existing versioned deployment as described above.

Temporary editor-only test function:

```javascript
function testWianEnquiryAcknowledgement_() {
  sendWianEnquiryAcknowledgement_({
    email: 'CONTROLLED_WIAN_TEST_INBOX@example.com',
    name: 'Test Customer',
    phone: '0000000000',
    vehicle: 'TEST-VEHICLE',
    service: 'Test requirement',
    message: 'Phase 2 acknowledgement test'
  });
}
```

Replace the placeholder with a WIAN-controlled inbox before running the test. Do not commit the temporary test function or a real private test address.

## Failure behaviour

If email validation fails, the helper returns `{ sent: false, reason: 'invalid_email' }` without calling `MailApp`. If `MailApp` throws, the helper logs only a generic error type and returns `{ sent: false, reason: 'send_failed' }`. Neither path throws into `doPost(e)`, changes the original success response, retries processing, or resubmits the enquiry.
