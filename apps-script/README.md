# WIAN Google Apps Script acknowledgement integration

The production enquiry endpoint is an existing Google Apps Script web app whose source is not currently stored in this repository. The helper in `enquiry-acknowledgement.gs` is designed to extend that handler without replacing or changing how WIAN receives the original enquiry.

## Integration

1. Add `enquiry-acknowledgement.gs` to the existing Apps Script project.
2. Keep the current `doPost(e)` parsing, storage and WIAN notification logic unchanged.
3. Immediately after that existing processing succeeds, call:

   ```javascript
   sendWianEnquiryAcknowledgement_(data);
   ```

   Here, `data` is the same parsed enquiry object containing `email`, `name`, `vehicle` and `service`.
4. Redeploy the existing web app while retaining its current deployment URL.
5. Authorize the built-in Apps Script Mail service when Google requests it.

The helper validates the customer's email, sends the requested plain-text acknowledgement through `MailApp`, and catches email failures so they do not undo or interrupt the original WIAN enquiry workflow.

No Gmail password, SMTP credential, API key or other secret is required or stored in this repository.
