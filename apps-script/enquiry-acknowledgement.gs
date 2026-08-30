/**
 * WIAN enquiry acknowledgement helper for the existing Google Apps Script web app.
 *
 * Integration point:
 * Call sendWianEnquiryAcknowledgement_(data) only after the existing doPost(e)
 * logic has successfully recorded/forwarded the original enquiry to WIAN.
 * This helper is intentionally append-only and does not replace that logic.
 */
const WIAN_ACK_SUBJECT_ = 'We’ve received your enquiry — WIAN Auto Parts';

function sendWianEnquiryAcknowledgement_(data) {
  const customerEmail = String(data && data.email || '').trim();

  if (!isValidWianCustomerEmail_(customerEmail)) {
    console.warn('WIAN acknowledgement skipped: invalid customer email.');
    return { sent: false, reason: 'invalid_email' };
  }

  const customerName = wianSafeLine_(data.name) || 'there';
  const reference = wianEnquiryReference_(data);
  const body = [
    'Hi ' + customerName + ',',
    '',
    'Thank you for contacting WIAN Auto Parts.',
    '',
    'We’ve received your enquiry regarding your ' + reference + '.',
    '',
    'Our team will review the details you provided and get back to you with the appropriate recommendation, availability or quotation.',
    '',
    'If you need to follow up urgently or prefer WhatsApp, you can contact us on 9108327761.',
    '',
    'Regards,',
    '',
    'WIAN Auto Parts',
    '',
    'Quality Parts. Performance Driven.'
  ].join('\n');

  try {
    MailApp.sendEmail({
      to: customerEmail,
      subject: WIAN_ACK_SUBJECT_,
      body: body,
      name: 'WIAN Auto Parts',
      replyTo: 'winston.kennedy@wianautoparts.com'
    });
    return { sent: true };
  } catch (error) {
    console.error('WIAN acknowledgement email failed: ' + error);
    return { sent: false, reason: 'send_failed' };
  }
}

function isValidWianCustomerEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function wianSafeLine_(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

function wianEnquiryReference_(data) {
  const vehicle = wianSafeLine_(data && data.vehicle);
  const requirement = wianSafeLine_(data && data.service);
  return [vehicle, requirement].filter(Boolean).join(' / ') || 'vehicle or parts requirement';
}
