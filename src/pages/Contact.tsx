import { useState, FormEvent, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { contactService } from "@/api/services";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, MessageSquare, Send, Loader2, Phone } from "lucide-react";
import MarketingFooter from "../components/MarketingFooter";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsBreadcrumbs from "@/components/docs/DocsBreadcrumbs";
import DocsMobileHeader from "@/components/docs/DocsMobileHeader";
import SEO from "@/components/SEO";

interface FormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export default function Contact() {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    subject: "",
    message: ""
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);
    setError(null);

    try {
      await contactService.submitContactForm({
        name: formData.name,
        email: formData.email,
        subject: formData.subject,
        message: formData.message,
      });
      setSubmitted(true);
    } catch (err) {
      setError("Failed to send message. Please try emailing us directly at support@spannerwork.co.uk");
      if (import.meta.env.DEV) {
        console.error("Error sending contact form:", err);
      }
    } finally {
      setSending(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value
    });
  };

  return (
    <>
      <SEO
        title="Contact Us - SpannerWork Support"
        description="Get in touch with the SpannerWork team. We're here to help with questions about tool rentals, mechanic services, and workshop bookings."
        keywords="contact spannerwork, support, help, customer service, UK"
        schema={{
          "@context": "https://schema.org",
          "@type": "ContactPage",
          "mainEntity": {
            "@type": "Organization",
            "name": "SpannerWork",
            "email": "support@spannerwork.co.uk",
            "url": "https://spannerwork.co.uk"
          }
        }}
      />
      <DocsMobileHeader />
      <div className="min-h-screen bg-white">
        <div className="bg-gradient-to-r from-brand-800 to-brand-900 text-white px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl("Home"))}
            className="mb-6 text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Get In Touch</h1>
          <p className="text-xl text-brand-100">Questions? Feedback? We&apos;re here to help</p>
        </div>
      </div>

      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <DocsBreadcrumbs />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="lg:flex lg:gap-8">
          <div className="hidden lg:block w-[280px] flex-none">
            <DocsSidebar />
          </div>

          <div className="min-w-0 flex-1 grid md:grid-cols-2 gap-12 mb-16">
          {/* Contact Info */}
          <div>
            <h2 className="text-2xl font-bold mb-6">Contact Information</h2>
            <div className="space-y-6">
              <Card className="border-none shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-brand-800 to-brand-900 rounded-xl flex items-center justify-center">
                      <Mail className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold mb-1">Email Us</h3>
                      <a href="mailto:support@spannerwork.co.uk" className="text-brand-800 hover:underline">
                        support@spannerwork.co.uk
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-brand-800 to-brand-900 rounded-xl flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold mb-1">Response Time</h3>
                      <p className="text-gray-600">Usually within 24 hours</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-brand-800 to-brand-900 rounded-xl flex items-center justify-center">
                      <Phone className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold mb-1">Support Hours</h3>
                      <p className="text-gray-600">Monday - Friday, 9am - 6pm GMT</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-8 p-6 bg-gray-50 rounded-xl">
              <h3 className="font-bold mb-3">Common Questions?</h3>
              <p className="text-gray-600 mb-4">Check out our resources page for guides and FAQs</p>
              <Button
                variant="outline"
                onClick={() => navigate(createPageUrl("Resources"))}
              >
                View Resources
              </Button>
            </div>
          </div>

          {/* Contact Form */}
          <div>
            {!submitted ? (
              <Card className="border-none shadow-lg">
                <CardContent className="p-8">
                  <h2 className="text-2xl font-bold mb-6">Send Us a Message</h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Name *</Label>
                      <Input 
                        id="name" 
                        placeholder="Your name" 
                        required 
                        className="mt-2"
                        value={formData.name}
                        onChange={handleChange}
                        disabled={sending}
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder="your@email.com" 
                        required 
                        className="mt-2"
                        value={formData.email}
                        onChange={handleChange}
                        disabled={sending}
                      />
                    </div>
                    <div>
                      <Label htmlFor="subject">Subject *</Label>
                      <Input 
                        id="subject" 
                        placeholder="How can we help?" 
                        required 
                        className="mt-2"
                        value={formData.subject}
                        onChange={handleChange}
                        disabled={sending}
                      />
                    </div>
                    <div>
                      <Label htmlFor="message">Message *</Label>
                      <Textarea
                        id="message"
                        placeholder="Tell us more about your question or feedback..."
                        required
                        className="mt-2 h-32"
                        value={formData.message}
                        onChange={handleChange}
                        disabled={sending}
                      />
                    </div>
                    
                    {error && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                        {error}
                      </div>
                    )}

                    <Button 
                      type="submit" 
                      className="w-full bg-brand-800 hover:bg-brand-900"
                      disabled={sending}
                    >
                      {sending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-none shadow-lg bg-green-50">
                <CardContent className="p-12 text-center">
                  <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Send className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold mb-4">Message Sent!</h2>
                  <p className="text-gray-600 mb-4">
                    Thanks for reaching out, {formData.name}! We&apos;ll get back to you at {formData.email} within 24 hours.
                  </p>
                  <p className="text-sm text-gray-500 mb-8">
                    Check your email for a confirmation message from us.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button onClick={() => navigate(createPageUrl("Home"))}>
                      Back to Home
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setSubmitted(false);
                        setFormData({ name: "", email: "", subject: "", message: "" });
                      }}
                    >
                      Send Another Message
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          </div>
        </div>
      </div>

      <MarketingFooter />
      </div>
    </>
  );
}
