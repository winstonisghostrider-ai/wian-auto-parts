/**
 * WIAN Auto Parts customer acknowledgement email helper.
 *
 * Integration rule: call sendWianEnquiryAcknowledgement_(enquiry) exactly once,
 * only after the existing doPost(e) workflow has successfully completed all
 * processing that delivers the original enquiry to WIAN.
 *
 * This file intentionally does not define or replace doPost(e).
 */

var WIAN_ACK_SUBJECT_ = 'We’ve received your enquiry — WIAN Auto Parts';
var WIAN_ACK_SENDER_NAME_ = 'WIAN Auto Parts';
var WIAN_ACK_REPLY_TO_ = 'winston.kennedy@wianautoparts.com';

function sendWianEnquiryAcknowledgement_(enquiry) {
  try {
    var data = enquiry || {};
    var email = normaliseWianEmail_(data.email);

    if (!isValidWianEmail_(email)) {
      console.warn('WIAN customer acknowledgement skipped: invalid email address.');
      return { sent: false, reason: 'invalid_email' };
    }

    var name = sanitiseWianText_(data.name, 100) || 'there';
    var vehicle = sanitiseWianText_(data.vehicle, 160);
    var service = sanitiseWianText_(data.service, 160);
    var reference = buildWianEnquiryReference_(vehicle, service);

    var body = [
      'Hi ' + name + ',',
      'Thank you for contacting WIAN Auto Parts.',
      'We’ve received your enquiry regarding ' + reference + '.',
      'Our team will review the details you provided and get back to you with the appropriate recommendation, availability or quotation.',
      'If you need a quicker response or prefer WhatsApp, you can contact us on 9108327761.',
      'Regards,',
      'WIAN Auto Parts',
      'Quality Parts. Performance Driven.'
    ].join('\n\n');

    MailApp.sendEmail({
      to: email,
      subject: WIAN_ACK_SUBJECT_,
      body: body,
      name: WIAN_ACK_SENDER_NAME_,
      replyTo: WIAN_ACK_REPLY_TO_
    });

    return { sent: true };
  } catch (error) {
    console.error(
      'WIAN customer acknowledgement email failed (' +
      getWianSafeErrorName_(error) +
      ').'
    );
    return { sent: false, reason: 'send_failed' };
  }
}

function normaliseWianEmail_(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function isValidWianEmail_(email) {
  return email.length > 0 &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitiseWianText_(value, maxLength) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function buildWianEnquiryReference_(vehicle, service) {
  if (vehicle && service) return vehicle + ' / ' + service;
  if (vehicle) return vehicle;
  if (service) return service;
  return 'your submitted requirement';
}

function getWianSafeErrorName_(error) {
  var name = error && error.name ? error.name : 'Error';
  return sanitiseWianText_(name, 40) || 'Error';
}
