package com.acadion.backend.mail;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailSenderService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.from}")
    private String from;

    public EmailSenderService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendOtpEmail(String to, String otp) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(from);
            message.setTo(to);
            message.setSubject("Acadion OTP Verification");
            message.setText(
                    "Your OTP for Acadion account verification is: "
                            + otp
                            + "\n\nThis OTP is valid for 10 minutes."
            );
            mailSender.send(message);
        } catch (Exception e) {
            System.err.println("[EmailSenderService] Failed to send OTP email to " + to + ": " + e.getMessage());
            System.out.println("==================================================");
            System.out.println("ACADION OTP FOR " + to + " : " + otp);
            System.out.println("==================================================");
        }
    }

    public void sendApprovalEmail(String to) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(from);
            message.setTo(to);
            message.setSubject("Acadion Account Approved");
            message.setText(
                    "Your Acadion account has been approved by admin.\n\n"
                            + "You can now login to the system."
            );
            mailSender.send(message);
        } catch (Exception e) {
            System.err.println("[EmailSenderService] Failed to send Approval email to " + to + ": " + e.getMessage());
        }
    }

    public void sendRejectEmail(String to) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(from);
            message.setTo(to);
            message.setSubject("Acadion Account Rejected");
            message.setText(
                    "Your Acadion registration has been rejected by admin.\n\n"
                            + "Please register again with correct details."
            );
            mailSender.send(message);
        } catch (Exception e) {
            System.err.println("[EmailSenderService] Failed to send Reject email to " + to + ": " + e.getMessage());
        }
    }

    public void sendEvaluationResultEmail(
            String toEmail,
            String studentName,
            String subjectName,
            Double totalMarks,
            Double maxMarks,
            java.util.List<com.acadion.backend.entity.StudentResponse.ResponseAnswer> answers,
            String teacherName
    ) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(from);
            message.setTo(toEmail);
            message.setSubject("Acadion: Evaluation Result for " + (subjectName != null ? subjectName : "Exam"));

            StringBuilder sb = new StringBuilder();
            sb.append("Dear ").append(studentName != null ? studentName : "Student").append(",\n\n");
            sb.append("Your response paper for '").append(subjectName != null ? subjectName : "Exam").append("' has been evaluated.\n\n");
            sb.append("---------------------------------------------\n");
            sb.append("Total Marks: ").append(totalMarks != null ? totalMarks : 0.0).append(" / ").append(maxMarks != null ? maxMarks : 0.0).append(" Marks\n");
            if (maxMarks != null && maxMarks > 0 && totalMarks != null) {
                double pct = Math.round((totalMarks / maxMarks) * 10000.0) / 100.0;
                sb.append("Percentage: ").append(pct).append("%\n");
            }
            sb.append("Evaluated By: ").append(teacherName != null ? teacherName : "Faculty Member").append("\n");
            sb.append("---------------------------------------------\n\n");
            sb.append("Question-wise Feedback & Scores:\n");

            if (answers != null && !answers.isEmpty()) {
                for (com.acadion.backend.entity.StudentResponse.ResponseAnswer ans : answers) {
                    sb.append("• ").append(ans.getQuestionId() != null ? ans.getQuestionId() : "Question").append(": ");
                    sb.append(ans.getMarksObtained() != null ? ans.getMarksObtained() : 0).append(" / ")
                      .append(ans.getMaxMarks() != null ? ans.getMaxMarks() : 5).append(" Marks");
                    if (ans.getFeedback() != null && !ans.getFeedback().trim().isEmpty()) {
                        sb.append(" - Feedback: ").append(ans.getFeedback().trim());
                    }
                    sb.append("\n");
                }
            }

            sb.append("\nYou can login to your Acadion Student Dashboard to view full analysis and performance predictions.\n\n");
            sb.append("Best regards,\nAcadion Examination & Analytics Portal");

            message.setText(sb.toString());
            mailSender.send(message);
        } catch (Exception e) {
            System.err.println("[EmailSenderService] Failed to send Evaluation email to " + toEmail + ": " + e.getMessage());
        }
    }
}