import { dbConnection } from "../../config/db.js";

export default async function mergeData() {
  try {
    const { poolConnection, filteredDatabases } = await dbConnection();
    for (const db of filteredDatabases) {
     
      const [participants] = await poolConnection.query(`SELECT id, telephone, location, amount, name, email, coupon_send, address, postalcode, city, personal_number, points_scored, time_spent, sms_parts, sms_cost, agree_download_report, custom_text4, receiver_phone, recurring_history, game_type, Custom_timestamp_3, created FROM ${db}.participant WHERE created >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)`);

      const mergedData = {};

      const normalizePhone = (phone) => {
        if (!phone) return;

        //Sverige
        if (phone.startsWith("07")) return "46" + phone.slice(1);
        if (phone.startsWith("46")) return "46" + phone.slice(2);

        //Norge
        if (phone.startsWith("4") && !phone.startsWith("47")){
          return "474" + phone.slice(1);
        } 
        if (phone.startsWith("9")){
          return "479" + phone.slice(1);
        } 
        if (phone.startsWith("47")){
          return "47" + phone.slice(2);
        }
    
        //Finland
        if (
          phone.startsWith("040") ||
          phone.startsWith("041") ||
          phone.startsWith("044") ||
          phone.startsWith("045") ||
          phone.startsWith("046") ||
          phone.startsWith("050")
        ){return "358" + phone.slice(1);} 

        if(phone.startsWith("358")){
          return "358" + phone.slice(3);
        } 

        //Danmark
        if(
          phone.startsWith("30") ||
          phone.startsWith("40") ||
          phone.startsWith("50") && !phone.startsWith("45")
        ){return "45" + phone}

        if (phone.startsWith("45")){
          return "45" + phone.slice(2);
        }
    
        return phone;
      };

      // Process participant data as before...
      participants.forEach((participant) => {
        let phone = normalizePhone(participant.telephone);
        if (!phone) return;
       

        if (!mergedData[phone]) {
          mergedData[phone] = {
            locations: new Set(),
            participants_id: new Set(),
            total_amount: 0,
            giftcards_sent: 0,
            name: participant.name,
            email: participant.email,
            address: participant.address,
            zip: participant.postcode,
            city: participant.city,
            personal_number: participant.personal_number,
            quiz_answers: 0,
            custom_field_1: 0,
            custom_field_2: 0,
            custom_field_3: 0,
            custom_field_4: participant.agree_download_report,
            custom_field_5: 0,
            affiliated_views_generated: participant.affiliated_views_generated,
            affiliated_leads_generated: 0,
            affiliated_money_generated: 0,
            tags: "",
            all_dates: [],
            latest_date: participant.modified,
            paidCounter: 0,
            giftCounter: 0,
            phone,
          };
        }

        const data = mergedData[phone];
        if (participant.location) data.locations.add(participant.location);
        data.participants_id.add(participant.id);
        data.total_amount += +participant.amount;
        data.giftcards_sent += +participant.coupon_send;
        data.quiz_answers += parseFloat(participant.points_scored) || 0;
        data.custom_field_1 += parseFloat(participant.time_spent) || 0;
        data.custom_field_2 += parseInt(participant.sms_parts) || 0;
        data.custom_field_3 += parseFloat(participant.sms_cost) || 0;
        data.custom_field_5 += 1;

        // Update other properties if necessary
        data.name = participant.name;
        data.email = participant.email;
        data.address = participant.address;
        data.zip = participant.postcode;
        data.city = participant.city;
        data.personal_number = participant.personal_number;
        data.created = new Date().toISOString().slice(0, 19).replace("T", " ");
        data.modified = new Date().toISOString().slice(0, 19).replace("T", " ");
        data.latest_date = participant.modified;
        data.custom_field_4 = participant.agree_download_report;
  
          /*CUSTOM_TEXT4, AFFILIATED_VIEWS_GENERETED, AFFILIATED_LEADS_GENERETED, AFFILIATED_MONEY_GENERETED*/
          if (typeof participant.custom_text4 === "string") {
            const activeCount = participants.filter(
              (p) =>
                p.custom_text4 === "Active" &&
                p.recurring_history === "15" &&
                normalizePhone(p.telephone) === phone
            ).length;
  
            if (activeCount > 0) {
              const activeText = `Active x${activeCount}`;
  
              if (!data.affiliated_views_generated.includes(activeText)) {
                data.affiliated_views_generated.push(activeText);
              }
            }
  
            const deleteCount = participants.filter(
              (p) =>
                p.custom_text4 === "Deleted" &&
                p.recurring_history === "15" &&
                normalizePhone(p.telephone) === phone
            ).length;
  
            if (deleteCount > 0) {
              const deleteText = `Deleted x${deleteCount}`;
  
              if (!data.affiliated_views_generated.includes(deleteText)) {
                data.affiliated_views_generated.push(deleteText);
              }
            }
  
            const errorCount = participants.filter(
              (p) =>
                p.custom_text4 === "Error" &&
                p.recurring_history === "15" &&
                normalizePhone(p.telephone) === phone
            ).length;
  
            if (errorCount > 0) {
              const errorText = `Error x${errorCount}`;
  
              if (!data.affiliated_views_generated.includes(errorText)) {
                data.affiliated_views_generated.push(errorText);
              }
            }
          }
  
          if (participant.recurring_history === "15" && participant.amount) {
            data.affiliated_money_generated = participant.amount;
          }
  
          if (participant.recurring_history === "14") {
            data.tags++;
          }
  
          const paidCount = participants.filter(
            (p) =>
              p.recurring_history === "14" &&
              normalizePhone(p.telephone) === phone
          ).length;
  
          if (paidCount > 0) {
            const text = `Paid x${paidCount}`;
            if (!data.all_dates.includes(text)) {
              data.all_dates.push(text);
            }
          }
  
          const giftCount = participants.filter(
            (p) =>
              p.coupon_sent &&
              p.telephone_receiver_phone !== null &&
              p.telephone_receiver_phone !== "" &&
              normalizePhone(p.telephone) === phone
          ).length;
  
          if (giftCount > 0) {
            const textGift = `Giftcards Sent ${giftCount}`;
            if (!data.all_dates.includes(textGift)) {
              data.all_dates.push(textGift);
            }
          }
  
          if (participant.recurring_history === "6") {
            if (!data.all_dates.includes("Petition")) {
              data.all_dates.push("Petition");
            }
          }
          if (participant.recurring_history === "15") {
            const createdDate = new Date(participant.created);
            const customTimestamp3 = participant.custom_timestamp_3
              ? new Date(participant.custom_timestamp_3)
              : new Date(); // Om `custom_timestamp_3` saknas, använd dagens datum
  
            // Beräkna skillnaden i månader
            const diffInMonths =
              (customTimestamp3.getFullYear() - createdDate.getFullYear()) * 12 +
              (customTimestamp3.getMonth() - createdDate.getMonth());
  
            // Sätt värdet endast om diffInMonths är större än 0
            data.affiliated_leads_generated =
              diffInMonths > 0
                ? `${diffInMonths} month${diffInMonths === 1 ? "" : "s"}`
                : null;
          } else {
            data.affiliated_leads_generated = null; // Tomt om recurring_history inte är 15
          }
          if (participant.agree_download_report === 0) {
            if (!data.all_dates.includes("No newsletter")) {
              data.all_dates.push("No newsletter");
            }
          }
        });
  
      // Insert or update the leads table
      for (const phone in mergedData) {
        const data = mergedData[phone];
        data.locations = Array.from(data.locations).join(", ");
        data.participants_id = Array.from(data.participants_id).join(", ");

        if (data.paidCounter === 1) {
          data.all_dates.push(`Paid`);
        } else if(data.paidCounter > 1){
          data.all_dates.push(`Paid x${data.paidCounter}`);
        }

        if(data.giftCounter === 1){
          data.all_dates.push(`Giftcards sent`);
        } else if(data.giftCounter > 1){
          data.all_dates.push(`${data.giftCounter} Giftcards Sent`)
        }

        //Separera strängen med , tecknet. Annars om det inte finns många olika värden behåll det första
        if (data.all_dates.length > 1) {
          data.all_dates = data.all_dates.join(', ');
        } else {
          data.all_dates = data.all_dates[0];
        }

        const [existingRows] = await poolConnection.query(
          `SELECT * FROM ${db}.leads WHERE phone = ?`,
          [data.phone]
        );

        if (existingRows.length > 0) {
          const existingRow = existingRows[0];
         const hasChanges =
            existingRow.locations !== data.locations ||
            existingRow.participants_id !== data.participants_id ||
            existingRow.total_amount !== data.total_amount ||
            existingRow.name !== data.name ||
            existingRow.email !== data.email ||
            existingRow.address !== data.address ||
            existingRow.postcode !== data.postcode ||
            existingRow.all_dates !== data.all_dates ||
            existingRow.giftcards_sent !== data.giftcards_sent ||
            existingRow.latest_date !== data.latest_date ||
            existingRow.modified !== data.modified ||
            existingRow.custom_field_4 !== data.custom_field_4 ||
            existingRow.affiliated_views_generated !==
              data.affiliated_views_generated ||
            existingRow.custom_field_4 !== data.custom_field_4 ||
            existingRow.tags !== data.tags;
          if (hasChanges) {
            await poolConnection.query(
              `UPDATE ${db}.leads SET
                locations = ?, participants_id = ?, total_amount = ?,
                giftcards_sent = ?, name = ?, email = ?, address = ?,
                zip = ?, city = ?, personal_number = ?, quiz_answers = ?,
                custom_field_1 = ?, custom_field_2 = ?, custom_field_3 = ?,
                custom_field_4 = ?, custom_field_5 = ?, affiliated_views_generated = ?,
                affiliated_leads_generated = ?, affiliated_money_generated = ?,
                tags = ?, all_dates = ?, latest_date = ?
              WHERE phone = ?`,
              [
                data.locations,
                data.participants_id,
                data.total_amount,
                data.giftcards_sent,
                data.name,
                data.email,
                data.address,
                data.zip,
                data.city,
                data.personal_number,
                data.quiz_answers,
                data.custom_field_1,
                data.custom_field_2,
                data.custom_field_3,
                data.custom_field_4,
                data.custom_field_5,
                data.affiliated_views_generated,
                data.affiliated_leads_generated,
                data.affiliated_money_generated,
                data.tags,
                data.all_dates,
                data.latest_date,
                data.phone,
              ]
            );
            console.log(`Record updated for phone: ${data.phone}`);
          } else {
            console.log(`No changes for phone: ${data.phone}`);
          }
        } else {
          console.log(`Data inserted into ${db}`);
          await poolConnection.query(
            `INSERT INTO ${db}.leads
            (locations, participants_id, total_amount, giftcards_sent, name, phone,
             email, address, zip, city, personal_number, quiz_answers, custom_field_1,
             custom_field_2, custom_field_3, custom_field_4, custom_field_5,
             affiliated_views_generated, affiliated_leads_generated,
             affiliated_money_generated, tags, all_dates, latest_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              data.locations,
              data.participants_id,
              data.total_amount,
              data.giftcards_sent,
              data.name,
              data.phone,
              data.email,
              data.address,
              data.zip,
              data.city,
              data.personal_number,
              data.quiz_answers,
              data.custom_field_1,
              data.custom_field_2,
              data.custom_field_3,
              data.custom_field_4,
              data.custom_field_5,
              data.affiliated_views_generated,
              data.affiliated_leads_generated,
              data.affiliated_money_generated,
              data.tags,
              data.all_dates,
              data.latest_date,
            ]
          );
          console.log(`No data to insert into ${db}`);
          // console.log(`New record created for phone: ${data.phone}`);
        }
      }
    }

    console.log("Data merged successfully!");
  } catch (error) {
    console.error("Error during mergeData:", error);
  }
  console.log("Kör mergeData...");
}
