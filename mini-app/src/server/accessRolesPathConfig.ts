export const accessRolesPathConfig = {
  admin : [
    "files.uploadImage" ,
  ],
  checkin_officer : [
    "visitors.getAll" ,
    "telegramInteractions.requestSendQRCode" ,
    "registrant.getEventRegistrants" ,
    "registrant.getEventRegistrants" ,
    "EventPOA.Info" ,
    "EventPOA.Create" ,
    "registrant.processRegistrantRequest" ,
    "registrant.checkinRegistrantRequest",
    "ticket.getTicketByUuid",
    "ticket.checkInTicket",
    "telegramInteractions.requestExportFile",
  ],
}


